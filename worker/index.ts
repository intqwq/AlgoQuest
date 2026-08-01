/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  ALGOQUEST_API_ORIGIN?: string;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// SVG sources are served directly and never routed through the optimizer.

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/v1" || url.pathname.startsWith("/api/v1/")) {
      const apiOrigin =
        env.ALGOQUEST_API_ORIGIN ?? "https://game.intqwq.com";
      const upstreamUrl = new URL(`${url.pathname}${url.search}`, apiOrigin);
      const headers = new Headers(request.headers);
      headers.delete("host");
      headers.set("x-forwarded-host", url.host);
      headers.set("x-forwarded-proto", url.protocol.slice(0, -1));
      try {
        return await fetch(
          new Request(upstreamUrl, {
            method: request.method,
            headers,
            body:
              request.method === "GET" || request.method === "HEAD"
                ? undefined
                : request.body,
            redirect: "manual",
          }),
        );
      } catch {
        return Response.json(
          { error: "PLAYER_API_UNAVAILABLE" },
          { status: 503, headers: { "cache-control": "no-store" } },
        );
      }
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;

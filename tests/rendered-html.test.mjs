import assert from "node:assert/strict";
import test from "node:test";

const developmentPreviewMeta =
  /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;

test("renders development preview metadata", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const response = await worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/html\b/i,
  );
  assert.match(await response.text(), developmentPreviewMeta);
});

test("proxies Player API requests to the self-hosted Core API", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("api-proxy-test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const originalFetch = globalThis.fetch;
  let forwarded;
  globalThis.fetch = async (request) => {
    forwarded = request;
    return Response.json({ player: { id: "test-player" } });
  };
  try {
    const response = await worker.fetch(
      new Request("https://algoquest.example/api/v1/me?fresh=1", {
        headers: { authorization: "Bearer test" },
      }),
      {
        ASSETS: {
          fetch: async () => new Response("Not found", { status: 404 }),
        },
        ALGOQUEST_API_ORIGIN: "https://game.intqwq.com",
      },
      {
        waitUntil() {},
        passThroughOnException() {},
      },
    );
    assert.equal(response.status, 200);
    assert.equal(
      forwarded.url,
      "https://game.intqwq.com/api/v1/me?fresh=1",
    );
    assert.equal(forwarded.headers.get("authorization"), "Bearer test");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

interface Fetcher {
  fetch(request: Request): Promise<Response>;
}

interface D1Database {
  readonly __algoquestD1Brand?: never;
}

declare module "cloudflare:workers" {
  export const env: {
    DB?: D1Database;
  };
}

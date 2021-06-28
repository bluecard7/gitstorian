import { Response, ServerRequest } from "https://deno.land/std@0.97.0/http/server.ts";
import { bookmark, flip, read } from "./api.ts";

function match(
  { method, url }: ServerRequest,
  expectedMethod: string,
  expectedURL: string,
): boolean {
  return method === expectedMethod && url.startsWith(expectedURL);
}

/*
 * interface Handlers {
 *  read: async () => string[],
 *  flip: async () => string[]
 *  bookmark: () => void
 * }
 * handle(
 * req: ServerRequest, 
 * { read, flip, bookmark }: Handlers = { read, flip, bookmark },
 * )
* */

export async function handle(req: ServerRequest): Promise<Response> {
  // to deal with CORS preflight
  if (match(req, "OPTIONS", "")) {
    return {
      status: 204,
      headers: new Headers({
        "Access-Control-Allow-Origin": "http://localhost:3000",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Max-Age": "86400",
      }),
    };
  }

  // path: /commit/<next|prev>/<hash>
  if (match(req, "GET", "/commits/")) {
    const path = req.url.split("/").slice(2);
    // todo: allow filename to be provided
    const [order, hash] = path;
    const body = JSON.stringify(await flip(order, { hash }));
    return { status: 200, body };
  }

  // if /diff/<hash>, then return file diff of that hash
  // if /diff/<hash>/<file>, then return diff of that file in that hash
  if (match(req, "GET", "/diffs/")) {
    const path = req.url.split("/").slice(2);
    const [hash, file] = path;
    const body = JSON.stringify(await read({ hash, path: file }));
    return { status: 200, body };
  }

  if (match(req, "POST", "/bookmark")) {
    const raw = await Deno.readAll(req.body);
    const page = JSON.parse(new TextDecoder().decode(raw))
    bookmark(page)
    return { status: 200 };
  }
  return { status: 404, body: "unknown path" };
}

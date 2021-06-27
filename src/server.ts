import * as http from "https://deno.land/std@0.97.0/http/server.ts";
import { flip, readHash, setup } from "./api.ts"; // maybe rename to lib?
import { existsSync } from "https://deno.land/std/fs/mod.ts";

const repoPath = Deno.args[0];
const { success, errMsg } = await setup(repoPath);
if (!success) {
  console.log(errMsg);
  Deno.exit(1);
}

const server = http.serve({ port: 8081 });
console.log(`HTTP webserver running at: http://localhost:8081/`);

function match(
  { method, url }: http.ServerRequest,
  expectedMethod: string,
  expectedURL: string,
): boolean {
  return method === expectedMethod && url.startsWith(expectedURL);
}

async function handle(req: http.ServerRequest): Promise<http.Response> {
  // path: /commit/<next|prev>/<hash>
  if (match(req, "GET", "/commits/")) {
    const path = req.url.split("/").slice(2);
    const [order, hash] = path;
    const body = JSON.stringify(await flip(order, hash));
    return { status: 200, body };
  }
  // if /diff/<hash>, then return file diff of that hash
  // if /diff/<hash>/<file>, then return diff of that file in that hash
  if (match(req, "GET", "/diffs/")) {
    const path = req.url.split("/").slice(2);
    const [hash, filename] = path;
    return { status: 200, body: await readHash(hash, filename) };
  }
  return { status: 404, body: "unknown path" };
}

for await (const req of server) {
  // to deal with CORS preflight
  if (req.method === "OPTIONS") {
    req.respond({
      status: 204,
      headers: new Headers({
        "Access-Control-Allow-Origin": "http://localhost:3000",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Max-Age": "86400",
      }),
    });
    continue;
  }

  const allowOriginHeader = {
    headers: new Headers({
      "Access-Control-Allow-Origin": "http://localhost:3000",
    }),
  };
  const res = { ...allowOriginHeader, ...(await handle(req)) };
  req.respond(res);
}

import * as http from "https://deno.land/std@0.97.0/http/server.ts";
import * as ripthebuild from "./api.ts"; // maybe rename to lib?
import { existsSync } from "https://deno.land/std/fs/mod.ts";

const repoPath = Deno.args[0]
const { success, errMsg } = ripthebuild.setup(repoPath)
if (!success) {
  console.log(errMsg)
  Deno.exit(1)
}

const server = http.serve({ port: 8081 });
console.log(`HTTP webserver running at: http://localhost:8081/`);

function match(
  { url, method }: http.ServerRequest,
  expectedMethod: string,
  expectedURL: string,
): boolean {
  return url.startsWith(expectedURL) && method === expectedMethod;
}

async function handle(req: http.ServerRequest): Promise<http.Response> {
  // maybe todo: remove prev, curr, next?
  if (match(req, "GET", "/commit/prev/")) {
    return { status: 200, body: await ripthebuild.request("p") };
  }
  if (match(req, "GET", "/commit/curr/")) {
    const filename = req.url.split('/').slice(-1)
    return { status: 200, body: await ripthebuild.request(`v ${filename}`) };
  }
  if (match(req, "GET", "/commit/next/")) {
    return { status: 200, body: await ripthebuild.request("n") };
  }

  // /commit/<hash?>/<file?>
  if (match(req, "GET", "/commit/") {
    // if just /commit/, then return block hashes
    // if /commit/<hash>/, then return file diff od that hash
    // if /commit/<hash>/<file>, then return diff of that file in that hash
    return { status: 200, body: await ripthebuild.request(``) }
  }

  return { status: 404, body: "unknown path" };
}

for await (const req of server) {
  // to deal with CORS preflight
  if (req.method === "OPTIONS") {
    req.respond({ 
      status: 204, 
      headers: new Headers({
        'Access-Control-Allow-Origin': 'http://localhost:3000',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Max-Age': '86400',
      }),
    })
    continue
  }

  const allowOriginHeader = {
      headers: new Headers({
        'Access-Control-Allow-Origin': 'http://localhost:3000',
      }),
  }
  const res = { ...allowOriginHeader, ...(await handle(req)) }
  req.respond(res);
}

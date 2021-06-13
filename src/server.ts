import * as http from "https://deno.land/std@0.97.0/http/server.ts";
import * as ripthebuild from "./api.ts"; // maybe rename to lib?

const server = http.serve({ port: 8081 });
console.log(`HTTP webserver running at: http://localhost:8081/`);

function matchURLAndMethod(
  { url, method }: http.ServerRequest,
  expectedMethod: string,
  expectedURL: string,
): boolean {
  // todo: support for query params
  return url === expectedURL && method === expectedMethod;
}

async function handle(req: http.ServerRequest): Promise<http.Response> {
  if (matchURLAndMethod(req, "POST", "/repo")) {
    const repoPath = new TextDecoder().decode(await Deno.readAll(req.body));
    const { success, errMsg } = await ripthebuild.setup(repoPath);
      
    return {
      status: success ? 200 : 409,
      body: success ? "setup complete" : errMsg,
    };
  }

  if (matchURLAndMethod(req, "GET", "/commit/prev")) {
    return { status: 200, body: await ripthebuild.request("p") };
  }
  if (matchURLAndMethod(req, "GET", "/commit/curr")) {
    // if ?file=<> is provided, then line should be `v ${file}`
    // similarly for the other paths
    return { status: 200, body: await ripthebuild.request("v") };
  }
  if (matchURLAndMethod(req, "GET", "/commit/next")) {
    return { status: 200, body: await ripthebuild.request("n") };
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

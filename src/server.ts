import * as http from "https://deno.land/std@0.97.0/http/server.ts";
import * as ripthebuild from "./api.ts"; // maybe rename to lib?
// deno run --allow-net --allow-run --allow-read --allow-write server.ts

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
  if (matchURLAndMethod(req, "POST", "/repo/mv")) {
    const repoPath = new TextDecoder().decode(await Deno.readAll(req.body));
    const { success, errMsg } = await ripthebuild.setup(repoPath);
    return {
      status: success ? 200 : 409,
      body: success ? "setup complete" : errMsg,
    };
  }
  if (matchURLAndMethod(req, "GET", "/prev")) {
    return { status: 200, body: await ripthebuild.request("p") };
  }
  // behavior if repo isn't setup is to use cwd...
  // also need to handle when git commands make no sense -> cwd is not a git repo
  // maybe better path is /commit/...
  if (matchURLAndMethod(req, "GET", "/curr")) {
    // if ?file=<> is provided, then line should be `v ${file}`
    // similarly for the other paths
    return { status: 200, body: await ripthebuild.request("v") };
  }
  if (matchURLAndMethod(req, "GET", "/next")) {
    return { status: 200, body: await ripthebuild.request("n") };
  }
  return { status: 404, body: "unknown path" };
}

for await (const request of server) {
  // handle(request).then(res => request.respond(res))
  request.respond(await handle(request));
}

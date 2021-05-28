import * as http from "https://deno.land/std@0.97.0/http/server.ts";
import * as ripthebuild from './api.ts'; // maybe rename to lib?
// deno run --allow-net --allow-run --allow-read --allow-write server.ts

const server = http.serve({ port: 8081 });
console.log(`HTTP webserver running.  Access it at:  http://localhost:8081/`);

async function handle(req: http.ServerRequest): Promise<http.Response> {
  const { url, method } = req;
  if (url === '/setup' && method === 'POST') {
    const repoPath = new TextDecoder().decode(await Deno.readAll(req.body))
    const { success, errMsg } = await ripthebuild.setup(repoPath)
    return { 
      status: success ? 200 : 409, 
      body: success ? 'setup complete' : errMsg,
    }
  }
  // maybe better path is /commit/...
  if (url === '/curr' && method === 'GET') {
    // if ?file=<> is provided, then line should be `v ${file}`
    // similarly for the other paths
    return { status: 200, body: await ripthebuild.request('v') }
  }
  if (url === '/next' && method === 'GET') {
    return { status: 200, body: await ripthebuild.request('n') }
  }
  if (url === '/prev' && method === 'GET') {
    return { status: 200, body: await ripthebuild.request('p') }
  }
  if (
  return { status: 404, body: 'unknown path' }
}

for await (const request of server) {
  // handle(request).then(res => request.respond(res))
  request.respond(await handle(request));
}

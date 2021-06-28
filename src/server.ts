import { serve } from "https://deno.land/std@0.97.0/http/server.ts";
import { setup } from "./api.ts";
import { handle } from './handler.ts'

const repoPath = Deno.args[0];
const { success, errMsg } = await setup(repoPath);
if (!success) {
  console.log(errMsg);
  Deno.exit(1);
}

const server = serve({ port: 8081 });
console.log(`HTTP webserver running at: http://localhost:8081/`);

for await (const req of server) {
  const allowOriginHeader = {
    headers: new Headers({
      "Access-Control-Allow-Origin": "http://localhost:3000",
    }),
  };
  const res = { ...allowOriginHeader, ...(await handle(req)) };
  req.respond(res);
}

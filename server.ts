import { serve } from "https://deno.land/std@0.97.0/http/server.ts";

const server = serve({ port: 8081 });
console.log(`HTTP webserver running.  Access it at:  http://localhost:8081/`);

function handler({ body }) {
  if (body === 'next') {}
  if (body === 'prev') {}
}

for await (const request of server) {
  let bodyContent = "Your user-agent is:\n\n";
  bodyContent += request.headers.get("user-agent") || "Unknown";

  request.respond({ status: 200, body: bodyContent });
}

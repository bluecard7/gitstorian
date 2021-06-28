import {
  assert,
  assertObjectMatch,
} from "https://deno.land/std@0.97.0/testing/asserts.ts";
import { ServerRequest } from "https://deno.land/std@0.97.0/http/server.ts";
import { BufReader } from "https://deno.land/std@0.97.0/io/bufio.ts";
import { Buffer } from "https://deno.land/std@0.97.0/io/buffer.ts";
import { handle } from "./handler.ts";

Deno.test("CORS", async () => {
  const req = new ServerRequest();
  req.headers = new Headers({
    "Origin": "http://localhost:3000",
  });
  req.url = "";
  req.method = "OPTIONS";
  const res = await handle(req);
  assert(res.status === 204);
  assertObjectMatch(
    { headers: res.headers },
    {
      headers: new Headers({
        "Access-Control-Allow-Origin": "http://localhost:3000",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Max-Age": "86400",
      }),
    },
  );
});

Deno.test("/bookmark", async () => {
  const data = JSON.stringify(["hash1", "hash2", "hash3"]);
  const req = new ServerRequest();
  req.headers = new Headers({
    "Content-Length": `${data.length}`,
  });
  req.url = "/bookmark";
  req.method = "POST";
  // not sure if this is how it's transcribed on front end
  const buf = new Buffer(new TextEncoder().encode(data));
  req.r = new BufReader(buf);

  const res = await handle(req);
  assert(res.status === 200);
  // kind of bleeds into api testing...
  // shouldn't throw an error
  Deno.removeSync(".ripthebuild");
});

// maybe mock handlers? 
// like provide another arg: handlers, which gets passed
// { read, flip, bookmark }. defaults are from api.ts
//
// or just import setup and move on

Deno.test("/commits/", async () => {})
Deno.test("/diffs/", async () => {})
Deno.test("unknown path", async () => {})




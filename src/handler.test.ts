/* Tests handler.ts, only checks wiring from request to API/lib */

import {
  assert,
  assertObjectMatch,
} from "https://deno.land/std@0.97.0/testing/asserts.ts";
import { ServerRequest } from "https://deno.land/std@0.97.0/http/server.ts";
import { BufReader } from "https://deno.land/std@0.97.0/io/bufio.ts";
import { Buffer } from "https://deno.land/std@0.97.0/io/buffer.ts";
import { handle } from "./handler.ts";

// Headers is in unexpected format
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

// todo: read arguments
function mockRead() {
  mockRead.calls.push(arguments);
  return Promise.resolve([]);
}
mockRead.calls = <any[]>[]

function mockFlip() {
  mockFlip.calls.push(arguments);
  return Promise.resolve([]);
}
mockFlip.calls = <any[]>[]

function mockBookmark() {
  mockBookmark.calls.push(arguments);
}
mockBookmark.calls = <any[]>[]

const resetCalls = () =>
  [mockRead, mockFlip, mockBookmark].forEach((mock) => mock.calls = []);
const callCounts = () =>
  [mockRead, mockFlip, mockBookmark].map(({ calls }) => calls.length);

const mockHandlers = {
  read: mockRead,
  flip: mockFlip,
  bookmark: mockBookmark,
};

Deno.test("/diffs/ - no hash, no file", async () => {
  const req = new ServerRequest();
  req.url = "/diffs/"
  req.method = "GET"
  resetCalls()
  const res = await handle(req, mockHandlers)
  assert(res.status === 400)
  assertObjectMatch({ msg: res.body }, { msg: "can't read without a hash" })
  assertObjectMatch({ count: callCounts() }, { count: [0, 0, 0] })
});

Deno.test("/diffs/ - hash, no file", async () => {
  const req = new ServerRequest();
  req.url = "/diffs/deadbeef" // what happen w/ leading forward slash
  req.method = "GET"
  resetCalls()
  const res = await handle(req, mockHandlers)
  assert(false)
});

Deno.test("/diffs/ - hash and file", async () => {
  const req = new ServerRequest();
  req.url = "/diffs/deadbeef/" // what happen w/ leading forward slash
  req.method = "GET"
  resetCalls()
  const res = await handle(req, mockHandlers)
  assert(false)
});

Deno.test("/commits/ - no order, no hash", async () => {
  const req = new ServerRequest();
  req.url = "/commits/"
  req.method = "GET"
  assert(false)
});

Deno.test("/commits/ - order, no hash", async () => {
  const req = new ServerRequest();
  req.url = "/commits/prev/" // leading slash or nah?
  req.method = "GET"
  assert(false)
});

Deno.test("/commits/ - order and hash", async () => {
  const req = new ServerRequest();
  req.url = "/commits/prev/deadbeef"
  req.method = "GET"
  assert(false)
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

  resetCalls()
  const res = await handle(req, mockHandlers);
  assert(res.status === 200);
  assertObjectMatch({ counts: callCounts() }, { counts: [0, 0, 1] })
});

Deno.test("unknown path", async () => {
  resetCalls()
  const res = await handle(new ServerRequest(), mockHandlers)
  assert(res.status === 404);
  assertObjectMatch({ counts: callCounts() }, { counts: [0, 0, 0] })
  assertObjectMatch({ msg: res.body }, { msg: "unknown path" }) 
});

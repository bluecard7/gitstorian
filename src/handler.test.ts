/* Tests handler.ts, only checks wiring from request to API/lib */

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
  req.url = "";
  req.method = "OPTIONS";
  const res = await handle(req);
  assert(res.status === 204);
  // iterator b/c of assrtObjectMatch's quirks
  assertObjectMatch(
    { headers: res.headers },
    {
      headers: new Headers({
        "Access-Control-Allow-Origin": "http://localhost:3000",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Max-Age": "86400",
      })[Symbol.iterator](),
    },
  );
});

function mockRead() {
  mockRead.calls.push(arguments);
  return Promise.resolve([]);
}
mockRead.calls = <any[]> [];

function mockFlip() {
  mockFlip.calls.push(arguments);
  return Promise.resolve([]);
}
mockFlip.calls = <any[]> [];

function mockBookmark() {
  mockBookmark.calls.push(arguments);
}
mockBookmark.calls = <any[]> [];

const resetCalls = () =>
  [mockRead, mockFlip, mockBookmark].forEach((mock) => mock.calls = []);
const callCounts = () =>
  [mockRead, mockFlip, mockBookmark].map(({ calls }) => calls.length);

const mockHandlers = {
  read: mockRead,
  flip: mockFlip,
  bookmark: mockBookmark,
};

Deno.test("/diffs", async () => {
  const req = new ServerRequest();
  req.url = "/diffs";
  req.method = "GET";
  resetCalls();
  const res = await handle(req, mockHandlers);
  assert(res.status === 400);
  assertObjectMatch({ msg: res.body }, { msg: "can't read without a hash" });
  assertObjectMatch({ count: callCounts() }, { count: [0, 0, 0] });
});

Deno.test("/diffs/<hash>", async () => {
  const req = new ServerRequest();
  req.url = "/diffs/deadbeef";
  req.method = "GET";
  resetCalls();
  const res = await handle(req, mockHandlers);
  assertObjectMatch({ count: callCounts() }, { count: [1, 0, 0] });
  assertObjectMatch(
    { arg: [...mockRead.calls[0]] },
    { arg: [{ hash: "deadbeef" }] },
  );
});

Deno.test("/diffs/<hash>/<file>", async () => {
  const req = new ServerRequest();
  req.url = "/diffs/deadbeef/path/to/file";
  req.method = "GET";
  resetCalls();
  const res = await handle(req, mockHandlers);
  assertObjectMatch({ count: callCounts() }, { count: [2, 0, 0] });
  // need to destructure to rm array details
  // like length, Symbol.iterator, etc
  assertObjectMatch(
    { arg: [
      ...mockRead.calls[0],
      ...mockRead.calls[1],
    ]},
    { arg: [
      { hash: "deadbeef" },
      { hash: "deadbeef", path: "path/to/file" },
    ] },
  );
});

Deno.test("/commits", async () => {
  const req = new ServerRequest();
  req.url = "/commits";
  req.method = "GET";
  resetCalls();
  const res = await handle(req, mockHandlers);
  assertObjectMatch({ count: callCounts() }, { count: [0, 1, 0] });
  assertObjectMatch(
    { arg: [...mockFlip.calls[0]] },
    { arg: [undefined, {}] },
  );
});

Deno.test("/commits/<order>", async () => {
  const req = new ServerRequest();
  req.url = "/commits/prev";
  req.method = "GET";
  resetCalls();
  const res = await handle(req, mockHandlers);
  assertObjectMatch({ count: callCounts() }, { count: [0, 1, 0] });
  assertObjectMatch(
    { arg: [...mockFlip.calls[0]] },
    { arg: ["prev", {}] },
  );
});

// what happens when /commit//hash?
Deno.test("/commits/<order>/<hash>", async () => {
  const req = new ServerRequest();
  req.url = "/commits/prev/deadbeef";
  req.method = "GET";
  resetCalls();
  const res = await handle(req, mockHandlers);
  assertObjectMatch({ count: callCounts() }, { count: [0, 1, 0] });
  assertObjectMatch(
    { arg: [...mockFlip.calls[0]] },
    { arg: ["prev", { hash: "deadbeef" }] },
  );
});

Deno.test("/commits/<order>/<hash>/<path>", async () => {
  const req = new ServerRequest();
  req.url = "/commits/prev/deadbeef/path/to/a/file";
  req.method = "GET";
  resetCalls();
  const res = await handle(req, mockHandlers);
  assertObjectMatch({ count: callCounts() }, { count: [0, 1, 0] });
  assertObjectMatch(
    { arg: [...mockFlip.calls[0]] },
    { arg: ["prev", { hash: "deadbeef", path: "path/to/a/file" }] },
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

  resetCalls();
  const res = await handle(req, mockHandlers);
  assert(res.status === 200);
  assertObjectMatch({ counts: callCounts() }, { counts: [0, 0, 1] });
  // assertObjectMatch is inconsistent in how it treats
  // objects and arrays, so doing this to compare atm.
  assertObjectMatch(
    { arg: { ...mockBookmark.calls[0][0] } },
    { arg: { ...["hash1", "hash2", "hash3"] } },
  );
});

Deno.test("unknown path", async () => {
  resetCalls();
  const res = await handle(new ServerRequest(), mockHandlers);
  assert(res.status === 404);
  assertObjectMatch({ counts: callCounts() }, { counts: [0, 0, 0] });
  assertObjectMatch({ msg: res.body }, { msg: "unknown path" });
});

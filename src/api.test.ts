import { assert, assertObjectMatch } from "https://deno.land/std@0.97.0/testing/asserts.ts";

import { flip, readHash, setup } from "./api.ts";

// more integration testy by nature
// use this repo as the fixture
assert(Deno.cwd().endsWith("ripthebuild"));
setup(Deno.cwd());

const first = (arr: any[]): any => arr[0];
const last = (arr: any[]): any => arr.slice(-1)[0];

Deno.test("general flipping, no cache", async () => {
  const pg1 = await flip();
  const pg2 = await flip("next", last(pg1));
  const got = await flip("prev", first(pg2));
  assertObjectMatch({ res: got }, { res: pg1 })
});

Deno.test("last page is prev of page 1", async () => {
  const pg1 = await flip()
  assertObjectMatch(
    { res: await flip("prev", first(pg1)) }, 
    { res: await flip("prev") },
  )
});

Deno.test("page 1 is next of last page", async () => {
  const lastPg = await flip("prev")
  assertObjectMatch(
    { res: await flip("next", last(lastPg)) }, 
    { res: await flip() },
  )
});

Deno.test("1st flip gets bookmark, if cached", async () => {
  assert(false);
});

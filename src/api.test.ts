import { existsSync } from "https://deno.land/std/fs/mod.ts";
import {
  assert,
} from "https://deno.land/std@0.97.0/testing/asserts.ts";

import { flip, readHash, setup } from "./api.ts";

// more integration testy by nature
// use this repo as the fixture
assert(Deno.cwd().endsWith("ripthebuild"));
setup(Deno.cwd());

const first = (arr: any[]): any => arr[0];
const last = (arr: any[]): any => arr.slice(-1)[0];

// maybe adjustable pg size?
Deno.test("flipping, no cache", async () => {
  const pg1 = await flip();
  assertEquals(pg1.length, 10);

  const pg0 = await flip("prev", first(pg1));
  assertEquals(pg0.length, 0);

  const pg2 = await flip("next", last(pg1));
  const expectPg1 = await flip("prev", first(pg2));
  assert(pg1.length === expectPg1.length);
  pg1.forEach((hash, i) => {
    assert(hash === expectPg1[i]);
  });
});

Deno.test("1st flip gets bookmark, if cached", async () => {
  assert(false);
});

Deno.test("...", async () => {
  assert(false);
});

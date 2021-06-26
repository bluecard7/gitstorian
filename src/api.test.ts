import { existsSync } from "https://deno.land/std/fs/mod.ts";
import { assertEquals, assertObjectMatch } from "https://deno.land/std@0.97.0/testing/asserts.ts";

import { flip, read, setup } from "./api.ts";

// more integration testy by nature
// use this repo as the fixture
const currentRepo = Deno.cwd().split('/').slice(-1)[0]
assertEquals(currentRepo, "ripthebuild")

Deno.test("", async () => {
});

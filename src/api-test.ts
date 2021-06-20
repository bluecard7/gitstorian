import { assertObjectMatch } from "https://deno.land/std@0.97.0/testing/asserts.ts";

import { setup, testExports } from "./api.ts";
import { ExecCtx, execCtx } from "./ctx.ts";
execCtx.set(ExecCtx.Test);

// setup
function createFolder(name: string, mode: number): () => void {
  Deno.mkdirSync(name, { mode });
  const baseDir = Deno.cwd();
  return () => {
    Deno.chdir(baseDir);
    Deno.removeSync(name);
  };
}

Deno.test("setup succeeds", async () => {
  const cleanup = createFolder("repo", 0o777);
  const result = await setup("repo");
  cleanup();
  assertObjectMatch(result, { success: true, errMsg: "" });
});

Deno.test("setup fails due to nonexistent repo", async () => {
  const result = await setup("repo");
  assertObjectMatch(result, { success: false, errMsg: "repo does not exist" });
});

Deno.test("setup fails due to insufficient permissions", async () => {
  const cleanup = createFolder("repo", 0o200);
  const result = await setup("repo");
  cleanup();
  assertObjectMatch(result, {
    success: false,
    errMsg: "not allowed to access repo",
  });
});

// gitCmds formatting functions
const { gitCmds } = testExports;
Deno.test("gitCmds.hashes creates a command that gets hashes from start of history if called with falsy value", async () => {
  // need a repo setup with at least one commit
  throw Error("not ready");
  // probably will be called with empty string
  const result = gitCmds.hashes("");
  assertEquals(result, "...");
});

Deno.test("gitCmds.hashes creates a command that gets the next 5 commits after the commit provided", () => {});
Deno.test("gitCmds.diff w/ no filename", () => {});
Deno.test("gitCmds.diff w/ filename", () => {});

// CommitCache
const { commitCache } = testExports;
Deno.test("commitCache starts empty if no store", () => {});
Deno.test("commitCache gets saved session if available", () => {});
// need this test?
Deno.test("commitCache starts empty if store is empty", () => {});
// test around reads
Deno.test("commitCache read", () => {});
// test around persist
Deno.test("commitCache persists", () => {});

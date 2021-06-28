import {
  assert,
  assertObjectMatch,
} from "https://deno.land/std@0.97.0/testing/asserts.ts";
import { existsSync } from "https://deno.land/std/fs/mod.ts";
import { bookmark, flip, read, setup } from "./api.ts";

// use itself as the fixture
assert(Deno.cwd().endsWith("ripthebuild"));
// just assumes it succeeds
await setup(Deno.cwd());

// todo: test that setup fails if done in repo w/ 0 commits
// Or really just tests involving bookmarks
Deno.test("bookmark caches page", async () => {
  const usedPage = (await flip()).slice(3);
  // simulate partial page consumption + bookmarking
  bookmark(usedPage);
  assert(existsSync(".ripthebuild"));
  assertObjectMatch({ res: await flip() }, { res: usedPage });
  Deno.removeSync(".ripthebuild");
});

// should flips and reads fail if no repo setup?

const first = (arr: any[]): any => arr[0];
const last = (arr: any[]): any => arr.slice(-1)[0];

Deno.test("general flipping, no cache", async () => {
  const pg1 = await flip();
  const pg2 = await flip("next", { hash: last(pg1) });
  const got = await flip("prev", { hash: first(pg2) });
  assertObjectMatch({ res: got }, { res: pg1 });
});

Deno.test("last page is prev of page 1", async () => {
  const pg1 = await flip();
  assertObjectMatch(
    { res: await flip("prev", { hash: first(pg1) }) },
    { res: await flip("prev") },
  );
});

Deno.test("page 1 is next of last page", async () => {
  const lastPg = await flip("prev");
  assertObjectMatch(
    { res: await flip("next", { hash: last(lastPg) }) },
    { res: await flip() },
  );
});

// Should the menu be the server's responsibility?
const affectedFiles = (lines: string[]) =>
  lines.map((line) => line.split("|"))
    .reduce((acc, parts) => {
      if (parts.length === 2) acc.push(parts[0].trim());
      return acc;
    }, []);

Deno.test("flipping for specific file", async () => {
  const path = "src/api.ts";
  const page = await flip("next", { path });
  const diffStats = await Promise.all(
    page.map((hash) => read({ hash })),
  );
  assert(
    diffStats.map(affectedFiles).every((names) =>
      names.some((name) => name.includes(path))
    ),
  );

  // just shows that a file diff is generated
  const fileDiffs = await Promise.all(
    page.map((hash) => read({ hash, path })),
  );
  assert(fileDiffs.every(
    (lines) =>
      lines.some((line) => {
        return line[9] === "+" || line[0] === "-";
      }),
  ));
});

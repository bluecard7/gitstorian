import { assertObjectMatch } from "https://deno.land/std@0.97.0/testing/asserts.ts";

import * as ripthebuild from "../src/api.ts";

// fixture in this case is a git repo
function createFixture(name: string, perm: number): function {

  return () => {} // call to cleanup fixture
}


Deno.test("setup succeeds", () => {
  const cleanup = createFixture('repo', 777);
  assertObjectMatch(
    ripthebuild.setup('repo'),
    { success: true, errMsg: '' }
  )
  cleanup();
});

Deno.test("setup fails due to nonexistent repo", () => {
  assertObjectMatch(
    ripthebuild.setup('repo'),
    { success: false, errMsg: 'could not find repo' }
  )
});

Deno.test("setup fails due to insufficient permissions", () => {
  const cleanup = createFixture('repo');
  assertObjectMatch(
    ripthebuild.setup('repo'),
    { success: false, errMsg: 'not allowed to view repo' }
  )
  cleanup();
});

// todo: separate buildGitCmd and test that
// crux of this entire service
// export it in "testing" object?

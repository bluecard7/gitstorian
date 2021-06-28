// Git version used here is 2.25.1
import { existsSync } from "https://deno.land/std/fs/mod.ts";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const lines = (text: string) => text.split("\n").filter(Boolean);
const PAGE_SIZE = 10;
const storeName = ".ripthebuild";

interface DiffOptions {
  hash?: string;
  // handling only files for now
  path?: string;
}

async function run(cmd: string): Promise<string> {
  console.log("[RUNNING]:", cmd);
  const p = Deno.run({
    cmd: ["sh"],
    stdin: "piped",
    stdout: "piped",
  });
  await p.stdin!.write(encoder.encode(cmd));
  await p.stdin!.close();
  const out = await p.output();
  p.close();
  return decoder.decode(out);
}

export async function read({ hash, path }: DiffOptions): Promise<string[]> {
  const defaults = `--oneline ${path ? "" : "--stat"}`;
  const fileOpt = path ? `-- ${path}` : "";
  const cmd = `git show ${defaults} ${hash} ${fileOpt}`;
  return lines(await run(cmd));
}

export function bookmark(page: string[]) {
  console.log('[PERSISTING]:', page);
  Deno.writeFileSync(storeName, encoder.encode(page.join('\n')), { create: true });
}

// flipping pages of commits mixes with the concept of reading
// a commit
export function flip(
  order: string = "",
  opts: DiffOptions = {},
): Promise<string[]> {
  if (!order) return initialPage();
  if (order === "prev") return prevPage(opts);
  return nextPage(opts);
}

// initial page is the page starting from the bookmark or
// the first page if the bookmark doesn't exist
async function initialPage(): Promise<string[]> {
  if (existsSync(storeName)) {
    const blob = decoder.decode(Deno.readFileSync(storeName));
    return lines(blob);
  }
  return await nextPage({});
}

async function prevPage({ hash, path }: DiffOptions): Promise<string[]> {
  const cmd = `git rev-list ${hash || "HEAD"} ${path || ""} -n${PAGE_SIZE + 1}`;
  // invariant is the commit from which the prev page is
  // grabbed from is included in the output. But this isn't
  // true when going from the first commit to the last page -
  // the first commit isn't after the last commit in git. So,
  // need to remove the first commit of the last page in that case.
  const step = hash ? [0, -1] : [1];
  const page = lines(await run(cmd)).reverse().slice(...step);
  return page.length ? page : prevPage({});
}

async function nextPage({ hash, path }: DiffOptions): Promise<string[]> {
  const range = hash ? `${hash}..` : "HEAD";
  // Need to use head instead of -n in this case
  // because reverse is applied after cutting
  const cmd = `git rev-list --reverse ${range} ${path || ""}`;
  const page = lines(await run(`${cmd} | head -n${PAGE_SIZE}`));
  return page.length ? page : nextPage({});
}

export async function setup(repoPath: string): Promise<{
  success: boolean;
  errMsg: string;
}> {
  let success = false;
  let errMsg = "";
  try {
    Deno.chdir(repoPath);
    // check if its a git repo
    if (!existsSync(".git")) {
      return { success, errMsg: `${Deno.cwd()} is not a git repo` };
    }
    const count = await run("git rev-list --count HEAD");
    if (!parseInt(count, 10)) {
      return { success, errMsg: `${Deno.cwd()} has no commits` };
    }
    success = true;
  } catch (err) {
    console.log("Repo path:", repoPath);
    errMsg = err.message;
    const { NotFound, PermissionDenied } = Deno.errors;
    if (err instanceof NotFound) {
      errMsg = `${repoPath} does not exist`;
    }
    if (err instanceof PermissionDenied) {
      errMsg = `not allowed to access ${repoPath}`;
    }
  }
  return { success, errMsg };
}

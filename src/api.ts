// Git version used here is 2.25.1
import { existsSync } from "https://deno.land/std/fs/mod.ts";

const lines = (text: string) => text.split("\n").filter(Boolean);
const PAGE_SIZE = 50;

export interface DiffOptions {
  hash?: string;
  path?: string; // just files
}

async function run(cmd: string): Promise<string> {
  console.log("[EXEC]", cmd);
  const p = Deno.run({
    cmd: ["sh"],
    stdin: "piped",
    stdout: "piped",
  });
  await p.stdin!.write(new TextEncoder().encode(cmd));
  await p.stdin!.close();
  const out = await p.output();
  p.close();
  return new TextDecoder().decode(out);
}

// ex. "efdgs34d" => ["43", "1332"]
export function order(hash: string): Promise<{ place: string; total: string }> {
  return Promise.all([
    run(`git rev-list --count ${hash}`),
    run("git rev-list --count HEAD"),
  ]).then(([place, total]) => ({ place, total }));
}

// Resolves paths when a file gets moved in git
// ex. a/{b => c}/d -> a/c/d
function resolvePath(path: string = ""): string {
  return path.split("/")
    .reduce((acc, part) => {
      if (part.startsWith("{")) {
        part = part.slice(1, -1).split("=>")[1];
      }
      acc.push(part.trim());
      return acc;
    }, <string[]> [])
    .join("/");
}

export async function readDiff({ hash, path }: DiffOptions): Promise<string[]> {
  const resolvedPath = resolvePath(path);
  const defaults = `--oneline ${resolvedPath ? "" : "--stat=100"}`;
  const fileOpt = resolvedPath ? `-- ${resolvedPath}` : "";
  const cmd = `git show ${defaults} ${hash} ${fileOpt}`;
  return lines(await run(cmd));
}

// reads file content, needs both hash + path
// todo: how handle really large files, like package-lock.json? Just
// not allow those?
// todo: handle non-existent paths?
export function readFile({ hash, path }: DiffOptions): Promise<string> {
  return run(`git show ${hash}:${resolvePath(path)}`);
}

let startupDir: string = "";
const storeName = ".ripthebuild";
let bookmarks: { [repoName: string]: string } = {};
const getRepo = () => Deno.cwd().split("/").slice(-1)[0];
export function bookmark(hash: string) {
  console.log("[SAVE]", `${getRepo()}:${hash}`);
  bookmarks = { ...bookmarks, [getRepo()]: hash };
  Deno.writeTextFileSync(
    `${startupDir}/${storeName}`,
    JSON.stringify(bookmarks),
    { create: true },
  );
}

export function flip(
  dir: string = "",
  opts: DiffOptions = {},
): Promise<string[]> {
  if (!dir) {
    const hash = bookmarks[getRepo()];
    return nextPage({ hash }).then(
      (page) => hash ? [hash, ...page] : page
    );
  }
  return dir === "prev" 
    ? prevPage(opts)
    : nextPage(opts);
}

async function prevPage({ hash, path }: DiffOptions): Promise<string[]> {
  const fileOpt = path ? `-- ${path}` : "";
  const cmd = `git rev-list ${hash || "HEAD"} ${fileOpt} -n${PAGE_SIZE + 1}`;
  const step = hash ? [0, -1] : [1];
  const page = lines(await run(cmd)).reverse().slice(...step);
  // todo: recursive if page length always 0
  return page.length ? page : prevPage({});
}

async function nextPage({ hash, path }: DiffOptions): Promise<string[]> {
  const range = hash ? `${hash}..` : "HEAD";
  const fileOpt = path ? `-- ${path}` : "";
  // Need to use head instead of -n in this case
  // because reverse is applied after cutting
  const cmd = `git rev-list --reverse ${range} ${fileOpt}`;
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
    startupDir = Deno.cwd();
    if (existsSync(storeName)) {
      bookmarks = JSON.parse(Deno.readTextFileSync(storeName));
    }
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

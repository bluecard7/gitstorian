// Git version used here is 2.25.1
import { existsSync } from "https://deno.land/std/fs/mod.ts";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const lines = (text: string) => text.split("\n").filter(Boolean);
const PAGE_SIZE = 10;
const storeName = ".ripthebuild";

export interface DiffOptions {
  hash?: string;
  // handling only files for now
  path?: string;
}

async function run(cmd: string): Promise<string> {
  console.log("[EXEC]", cmd);
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

// reads diff
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

export function bookmark(page: string[]) {
  console.log("[SAVE]", page);
  Deno.writeFileSync(storeName, encoder.encode(page.join("\n")), {
    create: true,
  });
}

// flipping pages of commits mixes with the concept of reading a commit
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

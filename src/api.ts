import { existsSync } from "https://deno.land/std/fs/mod.ts";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function lines(text: string) {
  return text.split("\n").filter(Boolean);
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

// functions that format args to the correct git command
// a "page" is 10 commit hashes
const PAGE_SIZE = 10;
const storeName = ".ripthebuild";

export async function readHash(
  hash: string = "",
  filename: string = "",
): Promise<string[]> {
  const defaults = `--oneline ${filename ? "" : "--stat"}`;
  const fileOpt = filename ? `-- ${filename}` : "";
  const cmd = `git show ${defaults} ${hash} ${fileOpt}`;
  return lines(await run(cmd));
}

// POST, with unread commits, maybe just last commit read?
function bookmark() {
  //console.log(`[PERSISTING]\n${data}`);
  //Deno.writeFileSync(storeName, encoder.encode(data), { create: true });
}

let firstCommit = "";
// flipping pages of commits mixes with the concept of reading
// a commit
export function flip(order: string = "", hash: string = ""): Promise<string[]> {
  if (!hash) return initialPage();
  if (order === "prev") return prevPage(hash);
  return nextPage(hash);
}

async function initialPage(): Promise<string[]> {
  const initialPage = await nextPage("");
  // need this to perform prev
  firstCommit = initialPage[0];
  if (existsSync(storeName)) {
    // todo: verify that this is executed
    const blob = decoder.decode(Deno.readFileSync(storeName));
    return lines(blob);
  }
  return initialPage;
}

async function prevPage(from: string): Promise<string[]> {
  const range = `${firstCommit} ${from}`;
  // Queries for all commits b/n first commit and from
  // inclusive, gets only the first PAGE_SIZE + 1 commits
  const cmd = `git rev-list ${range} -n${PAGE_SIZE + 1}`;
  return lines(await run(cmd))
    .reverse()
    .slice(0, -1);
}

async function nextPage(from: string): Promise<string[]> {
  // THINK this returns empty if from === HEAD
  const range = from ? `${from}..` : "HEAD";
  // Need to use head instead of just -n in this case
  // because reverse is applied after cutting in rev-list
  const cmd = `git rev-list --reverse ${range} | head -n${PAGE_SIZE}`;
  return lines(await run(cmd));
}

export function setup(repoPath: string): {
  success: boolean;
  errMsg: string;
} {
  let success = false;
  let errMsg = "";
  try {
    Deno.chdir(repoPath);
    // check if its a git repo
    if (!existsSync(".git")) {
      return { success, errMsg: `${Deno.cwd()} is not a git repo` };
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

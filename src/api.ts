import { existsSync } from "https://deno.land/std/fs/mod.ts";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

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

export async function read(hash: string, filename: string): Promise<string> {
  const defaults = `--oneline ${filename ? "" : "--stat"}`;
  const fileOpt = filename ? `-- ${filename}` : "";
  return run(`git show ${defaults} ${hash} ${fileOpt}`);
}

// POST, with unread commits, maybe just last commit read?
function bookmark() {
  //console.log(`[PERSISTING]\n${data}`);
  //Deno.writeFileSync(storeName, encoder.encode(data), { create: true });
}

// get rid of the class?
class CommitStream {
  firstCommit: string;
  constructor() {
    this.firstCommit = "";
  }

  // flipping pages of commits mixes with the concept of reading
  // a commit
  flip(order: string, hash: string): Promise<string[]> {
    if (!hash) return this.initialPage();
    if (order === "prev") return this.prevPage(hash);
    return this.nextPage(hash);
  }

  async initialPage(): Promise<string[]> {
    const initialPage = await this.nextPage("");
    // need this to perform prev
    this.firstCommit = initialPage[0];
    if (existsSync(storeName)) {
      // todo: verify that this is executed
      const blob = decoder.decode(Deno.readFileSync(storeName));
      return blob.split("\n").filter(Boolean);
    }
    return initialPage;
  }

  async prevPage(from: string): Promise<string[]> {
    const range = `${this.firstCommit} ${from}`;
    // Queries for all commits b/n first commit and from
    // inclusive, gets only the first PAGE_SIZE + 1 commits
    const cmd = `git rev-list ${range} -n${PAGE_SIZE + 1}`;
    return (await run(cmd)).split("\n")
      .filter(Boolean)
      .reverse()
      .slice(0, -1);
  }

  async nextPage(from: string): Promise<string[]> {
    // THINK this returns empty if from === HEAD
    const range = from ? `${from}..` : "HEAD";
    // Need to use head instead of just -n in this case
    // because reverse is applied after cutting in rev-list
    const cmd = `git rev-list --reverse ${range} | head -n${PAGE_SIZE}`;
    return (await run(cmd)).split("\n").filter(Boolean);
  }
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

const commitStream = new CommitStream();
export const flip = (hash: string, filename: string) => commitStream.flip(hash, filename)

// todo: see if mem of compiled binary is majorly affected by this import
// existsSync is ppretty simple to implement
import { existsSync } from "https://deno.land/std/fs/mod.ts";
import { execCtx } from "./ctx.ts";

/*
 * Notes:
 * if you want to support jumping between repos
 * either do absolute paths or keep starting point/dir
* */

const encoder = new TextEncoder();
const decoder = new TextDecoder();

// <command> [filename?]
function parse(line: string): {
  cmd: string; // technically could be undefined too, need validation
  filename: string | undefined;
} {
  const [cmd, filename] = line.split(" ");
  return { cmd, filename };
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
const gitCmds = {
  diff(commit: string, filename: string): string {
    let gitCmd = "show";
    const defaults = `--oneline ${filename ? "" : "--stat"}`;
    const fileOpt = filename ? `-- ${filename}` : "";
    return `git ${gitCmd} ${defaults} ${commit} ${fileOpt}`;
  },
};

// not really a cache, just uses it...
// manager? store?
class CommitCache {
  pos: number;
  cache: string[];
  storeName: string;
  firstCommit: string;

  constructor() {
    this.pos = 0;
    this.cache = [];
    this.storeName = ".ripthebuild";
    this.firstCommit = "";
  }

  // Loads first commits from persisted state. If it doesn't
  // exist, then fetch new commits from beginning.
  async _loadInitialCommits() {
    const initialPage = await this.nextPage("");
    // need this to perform prev
    this.firstCommit = initialPage[0];
    if (existsSync(this.storeName)) {
      const blob = decoder.decode(Deno.readFileSync(this.storeName));
      this.cache = blob.split("\n").filter(Boolean);
    } else {
      this.cache = initialPage;
    }
  }

  prev = () => this.pos -= 1;
  next = () => this.pos += 1;
  async read(): Promise<string> {
    if (this.cache.length === 0) {
      await this._loadInitialCommits();
    }
    // prev out of range
    // todo: can't go past first commit
    if (this.pos < 0) {
      this.cache = await this.prevPage(this.cache[0]);
      this.pos = this.cache.length - 1;
    }
    // next out of range
    // todo: can't go past last commit
    if (this.pos >= this.cache.length) {
      const lastCommitPos = this.cache.length - 1;
      this.cache = await this.nextPage(this.cache[lastCommitPos]);
      this.pos = 0;
    }
    return this.cache[this.pos] || "";
  }

  async prevPage(from: string | undefined): Promise<string[]> {
    const range = `${this.firstCommit}..${from}`;
    // includes from, so need to add 1 and remove it
    const cmd = `git rev-list ${range} | head -n${PAGE_SIZE + 1}`;
    return (await run(cmd)).split("\n").filter(Boolean).slice(1);
  }

  async nextPage(from: string | undefined): Promise<string[]> {
    const range = from ? `${from}..` : "HEAD";
    const cmd = `git rev-list --reverse ${range} | head -n${PAGE_SIZE}`;
    return (await run(cmd)).split("\n").filter(Boolean);
  }

  persist() {
    const { pos, cache, storeName } = this;
    const data = cache.slice(pos).join("\n");
    console.log(`[PERSISTING]\n${data}`);
    Deno.writeFileSync(storeName, encoder.encode(data), { create: true });
  }
}

const commitCache = new CommitCache();

// todo: explicitly setup first - fail requests otherwise
// don't like it uses folder server is run in by default
export async function setup(repoPath: string): Promise<{
  success: boolean;
  errMsg: string;
}> {
  let success = false;
  let errMsg = "";
  try {
    Deno.chdir(repoPath);
    success = true;
  } catch (err) {
    const { NotFound, PermissionDenied } = Deno.errors;
    errMsg = "unknown";
    if (err instanceof NotFound) {
      errMsg = `${repoPath} does not exist`;
    }
    if (err instanceof PermissionDenied) {
      errMsg = `not allowed to access ${repoPath}`;
    }
  }
  return { success, errMsg };
}

export async function request(line: string): Promise<string> {
  const { cmd, filename } = parse(line);
  cmd[0] === "n" && commitCache.next();
  // need validation of input, any input results in current
  // commit being viewed.
  // cmd[0] === "v" && view current commit
  const commit = await commitCache.read();
  return run(gitCmds.diff(commit, filename || ""));
}

export const { persist } = commitCache;
export const testExports = { commitCache, gitCmds };

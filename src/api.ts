import { existsSync } from "https://deno.land/std/fs/mod.ts";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

// /<hash?>/<filename?>
function parse(line: string): {
  hash: string;
  filename: string;
} {
  let [hash, filename] = line.split(" ");
  filename ||= ''
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

class CommitReader {
  storeName: string;

  constructor {
    this.storeName = ".ripthebuild";
  }

  async read(hash: string, filename: string): Promise<string> {
    return run(gitCmds.diff(hash, filename));
    /* move logic to client side
    cases to consider
    // prev out of range
    if (this.pos < 0) {
      if (this.firstCommit === this.cache[0]) {
        this.pos = 0;
        return this.firstCommit;
      }
      this.cache = await this.prevPage(this.cache[0]);
      this.pos = this.cache.length - 1;
    }
    // next out of range
    if (this.pos >= this.cache.length) {
      const lastCommitPos = this.cache.length - 1;
      const nextPage = await this.nextPage(this.cache[lastCommitPos]);
      // or should this be cyclic?
      // Prev on first goes to last commit
      // next on last goes to first
      if (!nextPage.length) return this.cache[lastCommitPos];
      this.cache = nextPage;
      this.pos = 0;
    }
    */
  }


  // POST, with unread commits, maybe just last commit read?
  bookmark() {
    const { pos, cache, storeName } = this;
    const data = cache.slice(pos).join("\n");
    console.log(`[PERSISTING]\n${data}`);
    Deno.writeFileSync(storeName, encoder.encode(data), { create: true });
  }
}

class CommitStream {
  // how to handle streaming?
  // can have client send commit and whether prev or next
  pos: number;
  cache: string[];
  firstCommit: string;

  constructor() {
    this.pos = 0;
    this.cache = [];
    this.firstCommit = "";
  }

  // Loads first commits from persisted state. If it doesn't
  // exist, then fetch new commits from beginning.
  async initialPage(): Promise<string[]> {
    const initialPage = await this.nextPage("");
    // need this to perform prev
    this.firstCommit = initialPage[0];
    if (existsSync(this.storeName)) {
      // todo: verify that this is executed
      const blob = decoder.decode(Deno.readFileSync(this.storeName));
      return blob.split("\n").filter(Boolean);
    }
    return initialPage;
  }

  async prevPage(from: string | undefined): Promise<string[]> {
    const range = `${this.firstCommit} ${from}`;
    // Queries for all commits b/n first commit and from
    // inclusive, gets only the first PAGE_SIZE + 1 commits
    const cmd = `git rev-list ${range} -n${PAGE_SIZE + 1}`;
    return (await run(cmd)).split("\n")
      .filter(Boolean)
      .reverse()
      .slice(0, -1);
  }

  async nextPage(from: string | undefined): Promise<string[]> {
    const range = from ? `${from}..` : "HEAD";
    // Need to use head instead of just -n in this case
    // because reverse is applied after cutting in rev-list
    const cmd = `git rev-list --reverse ${range} | head -n${PAGE_SIZE}`;
    return (await run(cmd)).split("\n").filter(Boolean);
  }
}

const commitReader = new CommitReader();
const commitStream = new CommitStream();

// todo: explicitly setup first - fail requests otherwise
// don't like it uses folder server is run in by default
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

export async function request(line: string): Promise<string> {
  const { hash, filename } = parse(line);
  return commitReader.read(hash, filename));
}

export const { bookmark } = commitCache;
export const testExports = { commitCache, gitCmds };

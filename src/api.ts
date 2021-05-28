// todo: see if mem of compiled binary is majorly affected by this import
// existsSync is ppretty simple to implement
import { existsSync } from "https://deno.land/std/fs/mod.ts";
import { execCtx } from "./ctx.ts";

// TODO: gitstorian command for viewing diffs
// just copy to Deno.stdout? Does less work in that case?

const encoder = new TextEncoder();
const decoder = new TextDecoder();

// <command> [filename?]
interface Options {
  cmd: string;
  filename: string | undefined;
}

function parse(line: string): Options {
  const [cmd, filename] = line.split(" ");
  return { cmd, filename };
}

async function run(cmd: string): Promise<string> {
  if (execCtx.is(ExecCtx.Test)) {
    return "not spawning process in test";
  }
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

function fmtHashesCmd(fromCommit: string): string {
  const from = fromCommit ? `${fromCommit}..` : "HEAD";
  return `git rev-list --reverse ${from} | head -n5`;
}

// instead having this process the filename, do that cache?
function fmtDiffCmd(commit: string, filename: string): string {
  let gitCmd = "show";
  const defaults = `--oneline ${filename ? "" : "--stat"}`;
  const fileOpt = filename ? `-- ${filename}` : "";
  return `git ${gitCmd} ${defaults} ${commit} ${fileOpt}`;
}

// todo: change name
// not really a cache, but a commit... manager?
// just happens to cache as well
// Or maybe there should be another class to describe purely handling commits
class CommitCache {
  pos: number;
  cache: string[];
  // file to persist session
  storeName: string;

  constructor() {
    this.pos = 0;
    this.cache = [];
    this.storeName = ".ripthebuild";
    // in case persisted data exists
    this._loadPersisted();
  }

  _loadPersisted() {
    if (existsSync(this.storeName)) {
      const blob = decoder.decode(Deno.readFileSync(this.storeName));
      this.cache = blob.split("\n").filter(Boolean);
    }
  }

  back = () => this.pos -= 1;
  _current = (): string => this.cache[this.pos] || "";
  forward = () => this.pos += 1;
  async read(): string {
    let value = this._current();
    if (this.pos + 1 === this.cache.length) {
      await this._hydrate();
      this.pos = 0;
    }
    return value;
  }

  async _hydrate() {
    const cmd = fmtHashesCmd(this._current());
    this.cache = (await run(cmd)).split("\n").filter(Boolean);
  }

  persist() {
    const { pos, cache, storeName } = this;
    const data = cache.slice(pos).join("\n");
    console.log(`[PERSISTING]\n${data}`);
    Deno.writeFileSync(storeName, encoder.encode(data), { create: true });
  }
}

const commitCache = new CommitCache();

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
      errMsg = `couldn't find: ${repoPath}`;
    }
    if (err instanceof PermissionDenied) {
      errMsg = `not allowed to view: ${repoPath}`;
    }
  }
  return { success, errMsg };
}

export async function request(line: string): Promise<string> {
  const { cmd, filename } = parse(line);
  cmd[0] === "n" && commitCache.next();
  if (cmd[0] === "v") {
    // do nothing, just show current commit
  }
  const commit = await commitCache.read()
  return run(fmtDiffCmd(commit, filename));
}

export const { persist } = commitCache;
export const testExports = {
  parse,
};

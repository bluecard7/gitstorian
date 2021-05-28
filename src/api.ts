// todo: see if mem of compiled binary is majorly affected by this import
// existsSync is ppretty simple to implement
import { existsSync } from "https://deno.land/std/fs/mod.ts";
import { execCtx } from "./ctx.ts";


// TODO: gitstorian command for viewing diffs
// just copy to Deno.stdout? Does less work in that case?

const encoder = new TextEncoder();
const decoder = new TextDecoder();

class GitCommandFormatter {
  hashes(fromCommit: string): string {
    const from = fromCommit ? `${fromCommit}..` : "HEAD";
    return `git rev-list --reverse ${from} | head -n5`;
  }

  // instead having this process the filename, do that cache?
  diff(commit: string, filename: string): string {
    let gitCmd = "show";
    const defaults = `--oneline ${filename ? "" : "--stat"}`;
    const fileOpt = filename ? `-- ${filename}` : "";
    return `git ${gitCmd} ${defaults} ${commit} ${fileOpt}`;
  }
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

  constructor () {
    this.pos = 0;
    this.cache = [];
    this.storeName = ".ripthebuild";
    // in case persisted data exists
    this._loadPersisted();
    // if there was none (or it was empty), run git command
    this.cache.length === 0 && this.hydrate();
  }

  _loadPersisted() {
    const { cache, storeName } = this
    if (existsSync(storeName)) {
      const blob = decoder.decode(Deno.readFileSync(storeName));
      cache = blob.split("\n").filter(Boolean);
    }
  }

  current(): string {
    const { pos, cache } = this;
    return pos < cache.length ? cache[pos] : "";
  }

  async hydrate(gitFmtr) {
    const cmd = fmtHashCmd(this.current());
    state.cache = (await run(cmd)).split("\n").filter(Boolean);
  }

  async next() {
    const { pos, cache } = this;
    if (pos < cache.length) {
      this.pos += 1;
      return;
    }
    await this.hydrate();
  }

  persist() {
    const { pos, cache, storeName } = this;
    const data = cache.slice(pos).join("\n");
    console.log(`[PERSISTING]\n${data}`);
    Deno.writeFileSync(storeName, encoder.encode(data), { create: true });
  }
}

const commitCache = new CommitCache();

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

async function interpret(line: string) {
  const { cmd, filename } = parse(line);
  cmd[0] === "n" && await cache.next();
  if (cmd[0] === "v") {
    // do nothing, just show current commit
  }
  
}

export async function request(line: string): Promise<string> {
  const opts = parse(line);
  const gitCmd = await buildGitCmd(opts, state);
  return run(gitCmd);
}

export function persist() { cache.persist(); }

export const testExports = {
  parse,
}

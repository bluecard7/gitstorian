import { exists } from "https://deno.land/std/fs/mod.ts";

// file to persist session
const STABLE_STORE = ".ripthebuild";

// TODO: gitstorian command for viewing diffs
// just copy to Deno.stdout? Does less work in that case?

const encoder = new TextEncoder();
const decoder = new TextDecoder();

interface State {
  pos: number;
  cache: string[];
}
const state: State = {
  pos: 0,
  cache: [],
};

async function updateHashes(state: State) {
  const from = curr(state) ? `${curr(state)}..` : "HEAD";
  const gitCmd = `git rev-list --reverse ${from} | head -n5`;
  state.cache = (await run(gitCmd)).split("\n").filter(Boolean);
  // console.log("[STATE]:", state)
}

async function loadCommit(state: State) {
  if (await exists(STABLE_STORE)) {
    const blob = decoder.decode(Deno.readFileSync(STABLE_STORE));
    state.cache = blob.split("\n").filter(Boolean);
    // what about case where there's nothing in the file?
    return;
  }
  await updateHashes(state);
}

function curr({ pos, cache }: State): string {
  return pos < cache.length ? cache[pos] : "";
}

async function next(state: State) {
  const { pos, cache } = state;
  if (pos < cache.length) {
    state.pos += 1;
    return;
  }
  await updateHashes(state);
}

async function run(gitCmd: string): Promise<string> {
  console.log("[RUNNING]:", gitCmd);
  const p = Deno.run({
    cmd: ["sh"],
    stdin: "piped",
    stdout: "piped",
  });
  await p.stdin!.write(encoder.encode(gitCmd));
  await p.stdin!.close();
  const out = await p.output();
  p.close();
  return decoder.decode(out);
}

// <command> [filename?]
interface Options {
  cmd: string;
  filename: string | undefined;
}

function parse(line: string): Options {
  const [cmd, filename] = line.split(" ");
  return { cmd, filename };
}

async function buildGitCmd(opts: Options, state: State): Promise<string> {
  const { cmd, filename } = opts;
  let gitCmd = "show";
  if (cmd[0] === "n") {
    await next(state);
  }
  if (cmd[0] === "v") {
    // do nothing, just show current commit
  }
  const defaults = `--oneline ${filename ? "" : "--stat"}`;
  const fileOpt = filename ? `-- ${filename}` : "";
  return `git ${gitCmd} ${defaults} ${curr(state)} ${fileOpt}`;
}

export async function setup(repoPath: string): Promise<{
  success: boolean;
  errMsg: string;
}> {
  let success = false;
  let errMsg = "";
  try {
    Deno.chdir(repoPath);
    await loadCommit(state);
    success = true;
  } catch (error) {
    const { NotFound, PermissionDenied } = Deno.errors;
    errMsg = "byzantine";
    if (error instanceof NotFound) {
      errMsg = `couldn't find: ${repoPath}`;
    }
    if (error instanceof PermissionDenied) {
      errMsg = `not allowed to view: ${repoPath}`;
    }
  }
  return { success, errMsg };
}

export async function request(line: string): Promise<string> {
  const opts = parse(line);
  const gitCmd = await buildGitCmd(opts, state);
  return run(gitCmd);
}

export function persist() {
  const { pos, cache } = state;
  const data = cache.slice(pos).join("\n");
  console.log(`[PERSISTING]\n${data}`);
  Deno.writeFileSync(STABLE_STORE, encoder.encode(data), { create: true });
}

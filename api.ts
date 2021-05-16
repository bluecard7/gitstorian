import { exists } from "https://deno.land/std/fs/mod.ts";

// file to persist session
const STABLE_STORE = ".gitstorian";

// TODO: gitstorian command for viewing diffs
// just copy to Deno.stdout? Does less work in that case?

const encoder = new TextEncoder();
const decoder = new TextDecoder();

interface State {
  // maybe keep as Uint8Array til string required?
  bookmark: string;
  cache: string[];
}
const state: State = {
  // Just use position in cache instead to get current commit?
  bookmark: "",
  cache: [],
};

async function updateHashes(state: State, commit?: string) {
  const from = commit ? `${commit}..` : "HEAD";
  const gitCmd = `git rev-list --reverse ${from} | head -n5`;
  state.cache = (await run(gitCmd))
    .split("\n")
    .filter(Boolean);
  state.bookmark = state.cache.shift() || "";
  // console.log("[STATE]:", state)
}

async function loadCommit(state: State) {
  if (await exists(STABLE_STORE)) {
    const blob = decoder.decode(Deno.readFileSync(STABLE_STORE));
    state.cache = blob.split("\n").filter(Boolean);
    state.bookmark = state.cache.shift() || "";
    return;
  }
  await updateHashes(state);
}

async function next(state: State) {
  if (state.cache.length) {
    state.bookmark = state.cache.shift() || "";
    return;
  }
  await updateHashes(state, state.bookmark);
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
  const { bookmark } = state;
  const defaults = `--oneline ${filename ? "" : "--stat"}`;
  const fileOpt = filename ? `-- ${filename}` : "";
  return `git ${gitCmd} ${defaults} ${bookmark} ${fileOpt}`;
}

export async function setup(repoPath: string) {
  Deno.chdir(repoPath);
  await loadCommit(state);
}

export async function request(line: string): Promise<string> {
  const opts = parse(line);
  const gitCmd = await buildGitCmd(opts, state);
  return run(gitCmd);
}

export function persist() {
  console.log("[PERSISTING]", state);
  const { bookmark, cache } = state;
  const data = [bookmark, ...cache].join("\n");
  Deno.writeFileSync(STABLE_STORE, encoder.encode(data), { create: true });
}

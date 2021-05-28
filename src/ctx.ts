// Used to determine code execution in different contexts
// i.e. testing, dev, etc.
export enum ExecCtx {
  None = "none",
  Test = "test",
  Dev = "dev",
}

// only using local variable here, may need to move to Deno.env
let currentCtx: ExecCtx = ExecCtx.None;

function set(ctx: ExecCtx) {
  currentCtx = ctx;
}

function is(ctx: ExecCtx): boolean {
  return currentCtx === ctx;
}

export const execCtx = { set, is };

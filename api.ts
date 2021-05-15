const encoder = new TextEncoder()
const decoder = new TextDecoder()

const state = {
  bookmark: ''
  // cache: []
}

async function run(cmd: string): Promise<string> {
  const p = Deno.run({
    cmd: ['sh'],
    stdin: 'piped',
    stdout: 'piped',
  })
  await p.stdin!.write(encoder.encode(cmd))
  await p.stdin!.close()
  const out = await p.output()
  p.close()
  return decoder.decode(out)
}

/*
 *  States:
 *  Show current commit + diff from next commit
 *
 *  git log -> history
 *  git diff -> state of commit
 *  maybe multple runs to get a cohesive look
 * */
function buildCmd(opts): string {
  let cmd: string
  switch (opts.type) {
    case 'flip': cmd = 'log'; break;
    case 'inspect': cmd = 'diff'; break;
  }

  const direction = opts.dive ? '' : '--reverse'

  // move head -n10 to run? basically our chunk size
  return `git ${cmd} ${direction} --oneline`
}

export const GitAPI = {
  init(repoPath: string) {
    Deno.chdir(repoPath)
    // grab bookmark and load into state
  },
  
  async request(opts: {
    type: string,
    filename: string,
  }): Promise<string> {
    const cmd = buildCmd(opts)
    return run(cmd)
  },
  
  persist() {}
}

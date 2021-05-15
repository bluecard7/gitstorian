import { GitAPI } from './api.ts'
import { requestPermission } from './permission.ts'

await requestPermission('run')
await requestPermission('read')
const repoPath = Deno.args[0] || Deno.cwd()

const cmdBuf = new Uint8Array(256);
async function main() {
  while (true) {
    const n = (await Deno.read(0, cmdBuf)) || 0
    const decoder = new TextDecoder()
    const line = decoder.decode(cmdBuf.subarray(0, n)).trim()
    if (line === 'quit') {
      console.log('Exiting...')
      return
    }
    const res = await GitAPI.request({mode: '', filename: ''})
    console.log(res)
    // bookmark flow
    // walk through the commits!
    // showing edited files per commit relative to adjacent commits
  }
}
const { init, persist } = GitAPI
init(repoPath)
await main()
persist()

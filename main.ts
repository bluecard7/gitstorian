// permissions
const { request: permRequest } = Deno.permissions;
const runPerm = await permRequest({ name: "run" })
if (runPerm.state !== 'granted') {
  console.log(`'run' permission denied`)
  Deno.exit(1)
} 
const readPerm = await permRequest({ name: "read" })
if (readPerm.state !== 'granted') {
  console.log(`'read' permission denied`)
  Deno.exit(1)
} 

console.log(Deno.args)
const gitRepo = Deno.args[0] || '../deno'

Deno.chdir(gitRepo)
const p = Deno.run({ 
  cmd: ['sh'],
  stdin: 'piped',
  stdout: 'piped',
})

const cmd = 'git log --reverse | head -n5'
await p.stdin.write(new TextEncoder().encode(cmd))
await p.stdin.close()
const out = await p.output()
console.log(new TextDecoder().decode(out))
p.close()

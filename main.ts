// permissions
async function requestPermission(name: Deno.PermissionName) {
  const { state } = await Deno.permissions.request({ name })
  if (state !== 'granted') {
    console.log(`'${name}' permission denied`)
    Deno.exit(1)
  } 
}

await requestPermission('run')
await requestPermission('read')

console.log(Deno.args)
const gitRepo = Deno.args[0] || '../deno'

Deno.chdir(gitRepo)
const p = Deno.run({ 
  cmd: ['sh'],
  stdin: 'piped',
  stdout: 'piped',
})

// --pretty=format:"%h | %cd %an", what is the message formatter?
const cmd = 'git log --reverse --pretty=oneline | head -n5'
await p.stdin.write(new TextEncoder().encode(cmd))
await p.stdin.close()
const out = await p.output()
console.log(new TextDecoder().decode(out))
p.close()

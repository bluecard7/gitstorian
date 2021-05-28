export async function requestPermission(name: Deno.PermissionName) {
  const { state } = await Deno.permissions.request({ name })
  if (state !== 'granted') {
    console.log(`'${name}' permission denied`)
    Deno.exit(1)
  }
}

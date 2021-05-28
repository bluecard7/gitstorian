import { requestPermission } from "./permission.ts";
import { request, setup, persist } from "./api.ts";

await requestPermission("run");
await requestPermission("read");
await requestPermission("write");
const repoPath = Deno.args[0] || Deno.cwd();

await setup(repoPath);
const cmdBuf = new Uint8Array(128);
const decoder = new TextDecoder();

// show current commit on start
let res = await request("v");
console.log(res);

while (true) {
  const n = (await Deno.read(0, cmdBuf)) || 0;
  const line = decoder.decode(cmdBuf.subarray(0, n)).trim();
  if (line === "q") {
    console.log("Exiting...");
    break;
  }
  res = await request(line);
  console.log(res);
}
persist();

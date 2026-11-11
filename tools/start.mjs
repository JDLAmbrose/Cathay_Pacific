import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

process.chdir(fileURLToPath(new URL("../", import.meta.url)));
const [major, minor] = process.versions.node.split(".").map(Number);
if (!(major === 20 && minor >= 19 || major === 22 && minor >= 12 || major > 22)) {
  console.error("Please install Node.js 24 LTS: https://nodejs.org/");
  process.exit(1);
}

const python = ["python3", "python", "py"].find((command) => {
  const check = spawnSync(command, ["-c", "import sys; assert sys.version_info >= (3, 9)"], {
    stdio: "ignore",
  });
  return check.status === 0;
});
if (!python) {
  console.error("Please install Python 3.9+: https://www.python.org/downloads/");
  process.exit(1);
}

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
function runNpm(args) {
  const result = spawnSync(npm, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.error || result.status !== 0) {
    console.error(result.error?.message || `npm ${args.join(" ")} failed.`);
    process.exit(result.status || 1);
  }
}

const fingerprint = createHash("sha256").update(readFileSync("package-lock.json")).digest("hex");
const marker = "node_modules/.plume-lock.sha256";
if (!existsSync(marker) || readFileSync(marker, "utf8") !== fingerprint || !existsSync("node_modules/vite")) {
  console.log("Installing the locked frontend dependencies…");
  runNpm(["ci"]);
  writeFileSync(marker, fingerprint);
}
console.log("Building the current source…");
// Local previews always mount at /, independently of a cloud build's base path.
delete process.env.PLUME_BASE_PATH;
runNpm(["run", "build"]);

const port = process.env.PLUME_PORT || "8000";
if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
  console.error("PLUME_PORT must be between 1 and 65535.");
  process.exit(1);
}
const url = `http://127.0.0.1:${port}/`;
const server = spawn(python, ["-u", "tools/serve.py", "--bind", "127.0.0.1", "--port", port], {
  stdio: ["inherit", "pipe", "inherit"],
});
server.on("error", (error) => { console.error(error.message); process.exitCode = 1; });
let opened = false;
server.stdout.on("data", (chunk) => {
  process.stdout.write(chunk);
  if (opened || !chunk.toString().includes("Plume Light:")) return;
  opened = true;
  console.log(`\nOpen ${url} — press Ctrl+C to stop.\n`);
  if (process.argv.includes("--no-open")) return;
  const [command, args] = process.platform === "darwin"
    ? ["open", [url]]
    : process.platform === "win32"
      ? ["cmd", ["/c", "start", "", url]]
      : ["xdg-open", [url]];
  const browser = spawn(command, args, { stdio: "ignore" });
  browser.on("error", () => console.log(`Open ${url} in your browser.`));
});
server.on("exit", (code) => { process.exitCode = code || 0; });
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => { server.kill(signal); });
}

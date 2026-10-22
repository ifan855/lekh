/**
 * Development runner: esbuild watches src/ and rebuilds dist/index.js, node
 * restarts the server whenever the bundle changes.
 */
import { spawn } from "node:child_process";

import { context } from "esbuild";

const ctx = await context({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  outfile: "dist/index.js",
  banner: {
    js: "import{createRequire}from'module';const require=createRequire(import.meta.url);",
  },
  logLevel: "info",
});

await ctx.watch();

const child = spawn(process.execPath, ["--watch", "dist/index.js"], {
  stdio: "inherit",
  env: process.env,
});

const shutdown = () => {
  child.kill();
  void ctx.dispose();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
child.on("exit", (code) => {
  void ctx.dispose();
  process.exit(code ?? 0);
});

const path = require("node:path");
const fs = require("node:fs");
const { spawnSync } = require("node:child_process");

const projectRoot = path.resolve(__dirname, "../..");

function run(binary, args) {
  const command = process.platform === "win32" ? `${binary}.cmd` : binary;
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

try {
  run("pnpm", ["build"]);

  const outDir = path.join(projectRoot, "out");
  if (!fs.existsSync(outDir)) {
    console.error("[Electron] Error: Next build did not produce an 'out' directory. Aborting Electron build.");
    process.exit(1);
  }

  run("electron-builder", []);
} catch (error) {
  console.error("[Electron] Build failed:", error.message);
  process.exit(1);
}

import { spawn } from "child_process"
import path from "path"

// Runs the Docusaurus CLI from the temp project with the current Node binary.
// This skips the `npm run` wrapper (faster startup) and needs no shell, so
// paths with spaces are passed through safely.
export function runDocusaurus(tempDir: string, args: string[]): Promise<number> {
  const docusaurusBin = path.join(
    tempDir,
    "node_modules",
    "@docusaurus",
    "core",
    "bin",
    "docusaurus.mjs"
  )

  return new Promise((resolve, reject) => {
    spawn(process.execPath, [docusaurusBin, ...args], {
      cwd: tempDir,
      stdio: "inherit",
    })
      .on("exit", (code) => resolve(code ?? 1))
      .on("error", reject)
  })
}

#!/usr/bin/env node
/**
 * Point Git at the repository's tracked hooks directory (.githooks).
 * Runs automatically after npm install via the "prepare" script.
 */
import { execFileSync } from "node:child_process"
import { existsSync } from "node:fs"

if (process.env.CI === "true" || !existsSync(".git")) process.exit(0)

try {
  execFileSync("git", ["config", "core.hooksPath", ".githooks"], { stdio: "ignore" })
  console.log("git hooks installed (core.hooksPath=.githooks)")
} catch (error) {
  console.warn("Could not install git hooks:", error.message)
}

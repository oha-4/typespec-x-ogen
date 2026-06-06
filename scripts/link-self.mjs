// Make the package resolvable as `typespec-x-ogen` from its own node_modules,
// so the test host (createTester) can `import "typespec-x-ogen"`. Idempotent
// and cross-platform; runs from `pretest`.
import { existsSync, lstatSync, mkdirSync, symlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const nodeModules = join(root, "node_modules");
const link = join(nodeModules, "typespec-x-ogen");

if (!existsSync(nodeModules)) {
  mkdirSync(nodeModules, { recursive: true });
}

let exists = false;
try {
  exists = lstatSync(link) !== undefined;
} catch {
  exists = false;
}

if (!exists) {
  symlinkSync(root, link, process.platform === "win32" ? "junction" : "dir");
  console.log("Linked node_modules/typespec-x-ogen -> package root");
}

import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const root = new URL("../", import.meta.url).pathname;
const ignored = new Set([
  ".cache",
  ".git",
  ".next",
  ".pnpm-store",
  ".secrets",
  "node_modules",
  "dist",
  "target",
  "coverage"
]);
const signatures = [
  /-----BEGIN (?:EC |RSA |OPENSSH )?PRIVATE KEY-----/,
  /sk-ant-[A-Za-z0-9_-]{24,}/,
  /gh[opusr]_[A-Za-z0-9]{30,}/
];
const findings = [];

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await walk(path);
    else if (!entry.name.endsWith(".woff2") && !entry.name.endsWith(".png")) {
      const content = await readFile(path, "utf8").catch(() => "");
      if (signatures.some((signature) => signature.test(content))) findings.push(relative(root, path));
    }
  }
}

await walk(root);
if (findings.length) {
  console.error(`Potential secrets found:\n${findings.join("\n")}`);
  process.exit(1);
}
console.log("Secret scan passed.");

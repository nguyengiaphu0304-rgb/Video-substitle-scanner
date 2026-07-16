import path from "node:path";
import { packageExtension } from "./extension-package.mjs";

const root = process.cwd();
const result = await packageExtension({
  sourceDir: path.join(root, "chrome-extension"),
  outputDir: path.join(root, "dist"),
});

console.log(`Packed ${result.packageManifest.entries.length} files:`);
console.log(result.archivePath);
console.log(`SHA-256 ${result.packageManifest.sha256}`);

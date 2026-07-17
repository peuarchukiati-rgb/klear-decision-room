import { rm, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const dataDir = process.env.KLEAR_DATA_DIR || "storage/cases";

await rm(dataDir, { recursive: true, force: true });
await mkdir(dataDir, { recursive: true });
await writeFile(join(dataDir, ".gitkeep"), "\n");

console.log(`Reset demo case storage at ${dataDir}`);

import { rm, mkdir } from "node:fs/promises";

const dataDir = process.env.KLEAR_DATA_DIR || "storage/cases";

await rm(dataDir, { recursive: true, force: true });
await mkdir(dataDir, { recursive: true });

console.log(`Reset demo case storage at ${dataDir}`);

import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CaseStore } from "../packages/case-store/src/caseStore.js";
import { writeGroundedCaseBrief } from "../packages/case-writer/src/index.js";
import { importIntakePacket, listDemoIntakePackets } from "../packages/intake/src/index.js";
import { runDeterministicReview } from "../packages/rules-engine/src/index.js";

const QUEUE_SCENARIOS = [
  "SCN-BANK-MISMATCH",
  "SCN-DUPLICATE",
  "SCN-MISSING-VENDOR",
  "SCN-CLEAN"
];

export async function seedDemoQueue({
  dataDir = process.env.KLEAR_DATA_DIR || "storage/cases",
  receivedAt = "2026-07-18T09:00:00.000Z"
} = {}) {
  await rm(dataDir, { recursive: true, force: true });
  await mkdir(dataDir, { recursive: true });
  await writeFile(path.join(dataDir, ".gitkeep"), "\n");

  const store = new CaseStore({ dataDir });
  const packets = await listDemoIntakePackets();
  const seeded = [];

  for (const scenarioId of QUEUE_SCENARIOS) {
    const demoPacket = packets.find((item) => {
      return item.kind === "structured" && item.scenario_id === scenarioId;
    });
    if (!demoPacket) {
      throw new Error(`Structured demo packet unavailable: ${scenarioId}`);
    }

    const imported = await importIntakePacket(store, {
      packet: { ...demoPacket.packet, received_at: receivedAt }
    });
    const reviewed = await runDeterministicReview(store, imported.case.case_id);
    const finalCase = scenarioId === "SCN-BANK-MISMATCH"
      ? (await writeGroundedCaseBrief(store, reviewed.case_id, { env: {}, allowFallback: true })).case
      : reviewed;

    seeded.push({
      scenario_id: scenarioId,
      case_id: finalCase.case_id,
      status: finalCase.status,
      version: finalCase.version
    });
  }

  return seeded;
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  const seeded = await seedDemoQueue();
  console.log(JSON.stringify({ seeded }, null, 2));
}

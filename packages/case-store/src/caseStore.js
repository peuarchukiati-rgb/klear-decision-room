import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  CaseStatus,
  HistoryChangeType,
  createDecisionCase,
  createHistoryEvent,
  changedFields,
  validateDecisionCase
} from "../../case-schema/src/index.js";

const DEFAULT_DATA_DIR = "storage/cases";

export class CaseStore {
  constructor({ dataDir = process.env.KLEAR_DATA_DIR || DEFAULT_DATA_DIR } = {}) {
    this.dataDir = dataDir;
  }

  async ensureReady() {
    await mkdir(this.dataDir, { recursive: true });
  }

  fileFor(caseId) {
    if (!/^[A-Z0-9-]+$/.test(caseId)) {
      throw new Error("case_id may only contain uppercase letters, numbers, and hyphens");
    }
    return path.join(this.dataDir, `${caseId}.json`);
  }

  async nextCaseId(now = new Date()) {
    await this.ensureReady();
    const year = now.getUTCFullYear();
    const prefix = `CASE-${year}-`;
    const files = await readdir(this.dataDir);
    const numbers = files
      .filter((file) => file.startsWith(prefix) && file.endsWith(".json"))
      .map((file) => Number(file.slice(prefix.length, -5)))
      .filter(Number.isInteger);
    const next = numbers.length ? Math.max(...numbers) + 1 : 1;
    return `${prefix}${String(next).padStart(4, "0")}`;
  }

  async createCase(input = {}) {
    await this.ensureReady();
    const caseId = input.case_id || (await this.nextCaseId());
    const decisionCase = createDecisionCase({
      ...input,
      case_id: caseId,
      status: input.status || CaseStatus.DRAFT
    });
    await this.writeCase(decisionCase);
    return decisionCase;
  }

  async listCases() {
    await this.ensureReady();
    const files = await readdir(this.dataDir);
    const cases = [];
    for (const file of files.filter((name) => name.endsWith(".json")).sort()) {
      const body = await readFile(path.join(this.dataDir, file), "utf8");
      cases.push(JSON.parse(body));
    }
    return cases;
  }

  async getCase(caseId) {
    const body = await readFile(this.fileFor(caseId), "utf8");
    const decisionCase = JSON.parse(body);
    validateDecisionCase(decisionCase);
    return decisionCase;
  }

  async saveCase(caseId, patch = {}, { actor, note = "Case saved.", source_event = "api" } = {}) {
    const existing = await this.getCase(caseId);
    const updated = {
      ...existing,
      ...patch,
      case_id: existing.case_id,
      version: existing.version,
      created_at: existing.created_at,
      updated_at: new Date().toISOString()
    };
    const changed = changedFields(existing, updated);
    updated.history = [
      ...existing.history,
      createHistoryEvent({
        actor,
        change_type: HistoryChangeType.CASE_SAVED,
        changed_fields: changed,
        previous_status: existing.status,
        new_status: updated.status,
        note,
        source_event
      })
    ];
    validateDecisionCase(updated);
    await this.writeCase(updated);
    return updated;
  }

  async versionCase(
    caseId,
    patch = {},
    {
      actor,
      change_type = HistoryChangeType.CASE_VERSIONED,
      note = "Case versioned.",
      source_event = "api"
    } = {}
  ) {
    const existing = await this.getCase(caseId);
    const updated = {
      ...existing,
      ...patch,
      case_id: existing.case_id,
      version: existing.version + 1,
      created_at: existing.created_at,
      updated_at: new Date().toISOString()
    };
    const changed = changedFields(existing, updated);
    updated.history = [
      ...existing.history,
      createHistoryEvent({
        actor,
        change_type,
        changed_fields: changed,
        previous_status: existing.status,
        new_status: updated.status,
        note,
        source_event
      })
    ];
    validateDecisionCase(updated);
    await this.writeCase(updated);
    return updated;
  }

  async writeCase(decisionCase) {
    await this.ensureReady();
    validateDecisionCase(decisionCase);
    await writeFile(this.fileFor(decisionCase.case_id), `${JSON.stringify(decisionCase, null, 2)}\n`);
  }
}

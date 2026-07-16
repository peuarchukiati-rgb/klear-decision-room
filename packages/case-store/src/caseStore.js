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

  versionDirFor(caseId) {
    if (!/^[A-Z0-9-]+$/.test(caseId)) {
      throw new Error("case_id may only contain uppercase letters, numbers, and hyphens");
    }
    return path.join(this.dataDir, "versions", caseId);
  }

  versionFileFor(caseId, version) {
    return path.join(this.versionDirFor(caseId), `v${String(version).padStart(4, "0")}.json`);
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
    await this.writeVersionSnapshot(decisionCase);
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

  async listVersions(caseId) {
    await this.ensureReady();
    const current = await this.getCase(caseId);
    let files = [];
    try {
      files = await readdir(this.versionDirFor(caseId));
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }

    if (!files.length) {
      return [
        {
          version: current.version,
          case_id: current.case_id,
          status: current.status,
          updated_at: current.updated_at,
          snapshot: current
        }
      ];
    }

    const versions = [];
    for (const file of files.filter((name) => name.endsWith(".json")).sort()) {
      const snapshot = JSON.parse(await readFile(path.join(this.versionDirFor(caseId), file), "utf8"));
      validateDecisionCase(snapshot);
      versions.push({
        version: snapshot.version,
        case_id: snapshot.case_id,
        status: snapshot.status,
        updated_at: snapshot.updated_at,
        snapshot
      });
    }
    return versions.sort((a, b) => a.version - b.version);
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
    await this.writeVersionSnapshot(updated);
    return updated;
  }

  async writeCase(decisionCase) {
    await this.ensureReady();
    validateDecisionCase(decisionCase);
    await writeFile(this.fileFor(decisionCase.case_id), `${JSON.stringify(decisionCase, null, 2)}\n`);
  }

  async writeVersionSnapshot(decisionCase) {
    await mkdir(this.versionDirFor(decisionCase.case_id), { recursive: true });
    const filePath = this.versionFileFor(decisionCase.case_id, decisionCase.version);
    try {
      await readFile(filePath, "utf8");
      return;
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }
    await writeFile(filePath, `${JSON.stringify(decisionCase, null, 2)}\n`, { flag: "wx" });
  }
}

import { Injectable, Inject } from "@nestjs/common";
import { createHash } from "node:crypto";
import type {
  AssessmentCategory,
  AssessmentSessionResponse,
  DeviceVendor
} from "@fitos/contracts";
import { FitosRepositoryToken } from "../../ports/tokens.js";
import type { FitosRepository, TenantScope } from "../../ports/fitos-repository.js";

export interface DeviceImportInput {
  branchId: string;
  memberId: string;
  deviceVendor: DeviceVendor;
  deviceSerial?: string;
  fileName?: string;
  fileContent: string;
}

export interface DeviceImportResult {
  session: AssessmentSessionResponse;
  rawChecksum: string;
  extractedMetricsCount: number;
}

@Injectable()
export class DeviceImportService {
  constructor(
    @Inject(FitosRepositoryToken) private readonly repository: FitosRepository
  ) {}

  async importDeviceData(
    scope: TenantScope,
    input: DeviceImportInput,
    assessorStaffId: string
  ): Promise<DeviceImportResult> {
    const rawChecksum = createHash("sha256").update(input.fileContent).digest("hex");

    const parsed = this.parseDevicePayload(input.deviceVendor, input.fileContent);

    // Find or locate suitable assessment definition
    const definitions = await this.repository.listAssessmentDefinitions(scope);
    let def = definitions.find((d) => d.deviceVendor === input.deviceVendor);
    if (!def) {
      def = await this.repository.createAssessmentDefinition(scope, {
        name: parsed.defaultDefinitionName,
        category: parsed.category,
        deviceVendor: input.deviceVendor,
        description: `Imported diagnostic biometrics via ${input.deviceVendor}`,
        metrics: Object.keys(parsed.metrics).map((k) => ({
          key: k,
          name: k.replace(/([A-Z])/g, " $1"),
          unit: "pts"
        }))
      });
    }

    const session = await this.repository.createAssessmentSession(
      scope,
      {
        branchId: input.branchId,
        memberId: input.memberId,
        definitionId: def.id,
        summary: parsed.summary,
        metrics: parsed.metrics,
        provenance: {
          source: "device_import",
          deviceVendor: input.deviceVendor,
          deviceSerial: input.deviceSerial,
          checksum: rawChecksum,
          parserVersion: "csv-json-v1",
          importedAt: new Date().toISOString()
        },
        notes: `Device import from ${input.fileName ?? input.deviceVendor}. Serial: ${input.deviceSerial ?? "N/A"}. Checksum: ${rawChecksum.slice(0, 12)}…`
      },
      assessorStaffId
    );

    return {
      session,
      rawChecksum,
      extractedMetricsCount: Object.keys(parsed.metrics).length
    };
  }

  private parseDevicePayload(
    vendor: DeviceVendor,
    content: string
  ): {
    category: AssessmentCategory;
    defaultDefinitionName: string;
    summary: string;
    metrics: Record<string, number | string>;
  } {
    const trimmed = content.trim();

    // Try JSON parsing first
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        const json = JSON.parse(trimmed) as Record<string, unknown>;
        return this.normalizeParsedData(vendor, json);
      } catch {
        // Fall back to CSV parsing
      }
    }

    // CSV / Key-Value parsing
    const lines = trimmed.split(/\r?\n/).filter(Boolean);
    const kv: Record<string, number | string> = {};

    for (const line of lines) {
      const parts = line.includes(",") ? line.split(",") : line.split(":");
      if (parts.length >= 2) {
        const key = parts[0]?.trim().replace(/[^a-zA-Z0-9]/g, "") || "";
        const valStr = parts[1]?.trim() || "";
        const num = parseFloat(valStr);
        if (key) {
          kv[key] = isNaN(num) ? valStr : num;
        }
      }
    }

    return this.normalizeParsedData(vendor, kv);
  }

  private normalizeParsedData(
    vendor: DeviceVendor,
    raw: Record<string, unknown>
  ): {
    category: AssessmentCategory;
    defaultDefinitionName: string;
    summary: string;
    metrics: Record<string, number | string>;
  } {
    const metrics: Record<string, number | string> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (typeof v === "number" || typeof v === "string") {
        metrics[k] = v;
      }
    }

    if (Object.keys(metrics).length === 0) {
      throw new Error("The uploaded device file contains no usable metric values.");
    }

    switch (vendor) {
      case "lookinbody_inbody": {
        return {
          category: "body_composition",
          defaultDefinitionName: "InBody 970 Multi-Frequency Segmental BIA Scan",
          summary: "Imported InBody body-composition assessment.",
          metrics
        };
      }

      case "vald_forcedecks": {
        return {
          category: "neuromuscular_force",
          defaultDefinitionName: "VALD ForceDecks CMJ Power & Kinetic Analysis",
          summary: "Imported VALD ForceDecks assessment.",
          metrics
        };
      }

      case "cosmed_k5":
      case "pnoe": {
        return {
          category: "cardiovascular_vo2",
          defaultDefinitionName: `${vendor.toUpperCase()} Metabolic VO2 Max Spirometry`,
          summary: `Imported ${vendor.toUpperCase()} metabolic assessment.`,
          metrics
        };
      }

      default:
        return {
          category: "body_composition",
          defaultDefinitionName: "Manual Clinical Screen",
          summary: "Diagnostic Biometrics Session",
          metrics
        };
    }
  }
}

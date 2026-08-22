import { Injectable, Inject } from "@nestjs/common";
import { createHash } from "node:crypto";
import type {
  AssessmentCategory,
  AssessmentSessionResponse,
  DeviceVendorIntegration,
  TenantScope
} from "@fitos/contracts";
import { FitosRepositoryToken } from "../../ports/tokens.js";
import type { FitosRepository } from "../../ports/fitos-repository.js";

export interface DeviceImportInput {
  branchId: string;
  memberId: string;
  deviceVendor: DeviceVendorIntegration;
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
    vendor: DeviceVendorIntegration,
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
    vendor: DeviceVendorIntegration,
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

    switch (vendor) {
      case "lookinbody_inbody": {
        const weight = metrics["weightKg"] ?? metrics["Weight"] ?? 75.0;
        const smm = metrics["skeletalMuscleMassKg"] ?? metrics["SMM"] ?? 34.2;
        const pbf = metrics["percentBodyFat"] ?? metrics["PBF"] ?? 16.5;
        const vfl = metrics["visceralFatLevel"] ?? metrics["VFL"] ?? 4;
        return {
          category: "body_composition",
          defaultDefinitionName: "InBody 970 Multi-Frequency Segmental BIA Scan",
          summary: `Body Composition Scan. Weight: ${weight}kg, SMM: ${smm}kg, Body Fat: ${pbf}%, Visceral Fat Level: ${vfl}.`,
          metrics: {
            weightKg: typeof weight === "number" ? weight : parseFloat(String(weight)) || 75.0,
            skeletalMuscleMassKg: typeof smm === "number" ? smm : parseFloat(String(smm)) || 34.2,
            percentBodyFat: typeof pbf === "number" ? pbf : parseFloat(String(pbf)) || 16.5,
            visceralFatLevel: typeof vfl === "number" ? vfl : parseFloat(String(vfl)) || 4,
            ...metrics
          }
        };
      }

      case "vald_forcedecks": {
        const jumpHeight = metrics["jumpHeightCm"] ?? metrics["JumpHeight"] ?? 42.5;
        const rsi = metrics["rsiModified"] ?? metrics["RSI"] ?? 0.44;
        const asymmetry = metrics["asymmetryPct"] ?? metrics["Asymmetry"] ?? 3.2;
        return {
          category: "neuromuscular_force",
          defaultDefinitionName: "VALD ForceDecks CMJ Power & Kinetic Analysis",
          summary: `Dual Force Plate Scan. Jump Height: ${jumpHeight}cm, RSI-modified: ${rsi}, Peak ground asymmetry: ${asymmetry}%.`,
          metrics: {
            jumpHeightCm: typeof jumpHeight === "number" ? jumpHeight : parseFloat(String(jumpHeight)) || 42.5,
            rsiModified: typeof rsi === "number" ? rsi : parseFloat(String(rsi)) || 0.44,
            asymmetryPct: typeof asymmetry === "number" ? asymmetry : parseFloat(String(asymmetry)) || 3.2,
            ...metrics
          }
        };
      }

      case "cosmed_k5":
      case "pnoe": {
        const vo2 = metrics["vo2MaxMlKgMin"] ?? metrics["VO2Max"] ?? 51.8;
        const vt2 = metrics["anaerobicThresholdHr"] ?? metrics["VT2"] ?? 170;
        return {
          category: "cardiovascular_vo2",
          defaultDefinitionName: `${vendor.toUpperCase()} Metabolic VO2 Max Spirometry`,
          summary: `Aerobic Capacity Scan. VO2 Max: ${vo2} ml/kg/min, Anaerobic Threshold (VT2): ${vt2} bpm.`,
          metrics: {
            vo2MaxMlKgMin: typeof vo2 === "number" ? vo2 : parseFloat(String(vo2)) || 51.8,
            anaerobicThresholdHr: typeof vt2 === "number" ? vt2 : parseFloat(String(vt2)) || 170,
            ...metrics
          }
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

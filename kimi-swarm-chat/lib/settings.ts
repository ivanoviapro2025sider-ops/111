import { db } from "@/lib/db";
import {
  DEFAULT_FILE_PROCESSING_CONFIG,
  DEFAULT_SAMPLING_CONFIG,
  DEFAULT_SWARM_CONFIG,
} from "@/lib/utils";

export async function ensureGlobalSettings() {
  const existing = await db.setting.findUnique({ where: { id: "global" } });
  if (existing) return existing;

  return db.setting.create({
    data: {
      id: "global",
      defaultSamplingConfig: DEFAULT_SAMPLING_CONFIG,
      defaultSwarmConfig: DEFAULT_SWARM_CONFIG,
      fileProcessingConfig: DEFAULT_FILE_PROCESSING_CONFIG,
      interfaceConfig: {
        theme: "dark",
        language: "ru",
        fontSize: "md",
        density: "comfortable",
        showDebugByDefault: false,
      },
    },
  });
}

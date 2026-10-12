import { idPhotoPresets } from "./presets/id-photo";
import type { PromptPreset, PromptPresetId } from "./types";

export const PROMPT_PRESET_REGISTRY = Object.freeze(
  Object.fromEntries(idPhotoPresets.map((preset) => [preset.id, preset])) as Record<PromptPresetId, PromptPreset>,
);

export function getPromptPreset(presetId: PromptPresetId): PromptPreset {
  const preset = PROMPT_PRESET_REGISTRY[presetId];
  if (!preset) throw new Error(`Unknown prompt preset: ${presetId}`);
  return preset;
}

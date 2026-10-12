import type { PromptPreset } from "../types";

function preset(
  id: PromptPreset["id"],
  style: PromptPreset["style"],
  runtimePromptId: PromptPreset["runtimePromptId"],
): PromptPreset {
  return {
    id,
    promptId: `${runtimePromptId}.${id}`,
    style,
    runtimePromptId,
  };
}

export const idPhotoPresets = [
  preset("resume-id", "resume", "id-photo"),
  preset("business-profile", "business-profile", "business-profile"),
  preset("profile-photo", "profile-photo", "profile-photo"),
  preset("underwater-correction", "underwater-correction", "underwater-correction"),
  preset("character-avatar", "character-avatar", "character-avatar"),
] as const satisfies readonly PromptPreset[];

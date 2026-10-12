import type { GenerationModelKey } from "@/lib/generation/model";
import type { ProfessionCategory } from "./business-profile/profession";

export type PromptPresetId = string;
export type PromptVersion = `${number}.${number}.${number}`;
export type RuntimePromptId =
  | "id-photo"
  | "business-profile"
  | "profile-photo"
  | "underwater-correction"
  | "character-avatar";
export type NonServiceRuntimePromptId = "basic-id" | "underwater";
export type PromptStyle =
  | "resume"
  | "business-profile"
  | "profile-photo"
  | "underwater-correction"
  | "character-avatar";
export type PromptExpression = "warm-smile" | "natural" | "neutral";
export type PromptBackground = "warm-gray" | "light-gray" | "white" | "blue-gray";
export type PromptClothing = "beige-jacket" | "dark-suit" | "navy-blazer" | "white-shirt" | "black-top";
export type PromptCrop = "chest-up";
export type PromptAspectRatio = "3:4";

export type PromptPreset = {
  id: PromptPresetId;
  promptId: string;
  style: PromptStyle;
  runtimePromptId: RuntimePromptId;
};

export type RuntimePrompt = {
  id: RuntimePromptId | NonServiceRuntimePromptId;
  version: PromptVersion;
  body: string;
};

export type PromptBuildInput = {
  presetId: PromptPresetId;
  model: GenerationModelKey;
  additionalRequest?: string;
};

export type CandidatePromptBuildInput = PromptBuildInput & {
  categoryId?: string;
  lookId?: string;
  hairStyleId?: string;
  profileOutfitId?: string;
  idBackgroundId?: string;
  idOutfitId?: string;
  idTieId?: string;
  characterStyleId?: string;
  characterOutfitId?: string;
  characterBackgroundId?: string;
  styleId?: string;
  outfitId?: string;
  backgroundId?: string;
  customRequest?: string;
  profession?: string;
};

export type PromptBuildResult = {
  prompt: string;
  promptId: string;
  promptVersion: PromptVersion;
  presetId: PromptPresetId;
  runtimePromptId: RuntimePromptId;
  /** @deprecated Runtime Prompt는 Module을 조합하지 않는다. DB 호환을 위해 빈 배열을 유지한다. */
  modules: string[];
  model: GenerationModelKey;
  profession?: string;
  professionCategory?: ProfessionCategory;
  professionModuleId?: string;
  styleId?: string;
  lookId?: string;
  characterStyleId?: string;
  characterOutfitId?: string;
  styleModifier?: string;
  candidateOutfitId?: string;
  candidateBackgroundId?: string;
};

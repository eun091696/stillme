import { businessProfileRuntimePrompt } from "./business-profile";
import { characterAvatarRuntimePrompt } from "./character-avatar";
import { idPhotoRuntimePrompt } from "./id-photo";
import { profilePhotoRuntimePrompt } from "./profile-photo";
import { underwaterCorrectionRuntimePrompt } from "./underwater-correction";
import type { RuntimePrompt, RuntimePromptId } from "../types";

type ServiceRuntimePrompt = RuntimePrompt & { id: RuntimePromptId };

const runtimePrompts = [
  idPhotoRuntimePrompt,
  businessProfileRuntimePrompt,
  profilePhotoRuntimePrompt,
  underwaterCorrectionRuntimePrompt,
  characterAvatarRuntimePrompt,
] as const satisfies readonly RuntimePrompt[];

export const RUNTIME_PROMPT_REGISTRY = Object.freeze(
  Object.fromEntries(runtimePrompts.map((prompt) => [prompt.id, prompt])) as Record<RuntimePromptId, ServiceRuntimePrompt>,
);

export function getRuntimePrompt(id: RuntimePromptId): ServiceRuntimePrompt {
  const prompt = RUNTIME_PROMPT_REGISTRY[id];
  if (!prompt) throw new Error(`Unknown runtime prompt: ${id}`);
  return prompt;
}

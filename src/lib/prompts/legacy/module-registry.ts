import { expressionPreservationModule } from "../core/expression-preservation";
import { facialGeometryModule } from "../core/facial-geometry";
import { hairPreservationModule } from "../core/hair-preservation";
import { identityModule } from "../core/identity";
import { outputSafetyModule } from "../core/output-safety";
import { personalDetailsModule } from "../core/personal-details";
import { portraitEditBoundaryModule } from "../core/portrait-edit-boundary";
import { skinPreservationModule } from "../core/skin-preservation";
import { sourceOfTruthModule } from "../core/source-of-truth";
import { idPhotoCompositionModule } from "../id-photo/composition";
import { idPhotoRestrictionsModule, idPhotoSafetyPriorityModule } from "../id-photo/restrictions";
import { idPhotoStudioQualityModule } from "../id-photo/studio-quality";
import { basicIdStyleModule } from "../styles/basic-id";
import { businessStyleModule } from "../styles/business";
import { profileStyleModule } from "../styles/profile";
import { resumeStyleModule } from "../styles/resume";
import { studentStyleModule } from "../styles/student";
import { underwaterModules } from "../underwater/modules";
import type { PromptModule } from "./types";

export const REGISTERED_PROMPT_MODULES = [
  sourceOfTruthModule,
  identityModule,
  facialGeometryModule,
  skinPreservationModule,
  hairPreservationModule,
  expressionPreservationModule,
  personalDetailsModule,
  portraitEditBoundaryModule,
  outputSafetyModule,
  idPhotoCompositionModule,
  idPhotoStudioQualityModule,
  idPhotoRestrictionsModule,
  idPhotoSafetyPriorityModule,
  profileStyleModule,
  businessStyleModule,
  resumeStyleModule,
  studentStyleModule,
  basicIdStyleModule,
  ...underwaterModules,
] as const satisfies readonly PromptModule[];

export const PROMPT_MODULE_REGISTRY = Object.freeze(
  Object.fromEntries(REGISTERED_PROMPT_MODULES.map((module) => [module.id, module])) as Record<string, PromptModule>,
);

export function getPromptModule(moduleId: string): PromptModule {
  const promptModule = PROMPT_MODULE_REGISTRY[moduleId];
  if (!promptModule) throw new Error(`Unknown prompt module: ${moduleId}`);
  return promptModule;
}

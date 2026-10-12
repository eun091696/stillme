export { classifyProfession, normalizeProfessionForClassification } from "./classifier";
export { PROFESSION_CLASSIFICATION_REGISTRY } from "./registry";
export { getProfessionStyleModule, PROFESSION_STYLE_MODULES } from "./modules";
export { PROFESSION_CATEGORIES } from "./types";
export {
  normalizeProfession,
  PROFESSION_MAX_LENGTH,
  ProfessionValidationError,
} from "./validation";
export type { ProfessionCategory, ProfessionStyleModule } from "./types";
export type { ProfessionValidationErrorCode } from "./validation";

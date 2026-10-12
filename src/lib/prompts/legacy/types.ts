export type PromptCategory = "core" | "style" | "preset" | "underwater";

export type PromptModule = {
  id: string;
  category: PromptCategory;
  section: string;
  lines: readonly string[];
};

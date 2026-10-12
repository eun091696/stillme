import {
  isR2StorageConfigured,
  usesLocalGenerationStorage,
} from "@/lib/generation/config";

import { createLocalImageStorageFromEnvironment } from "./local";
import { createR2StorageFromEnvironment } from "./r2";

export function createGenerationStorageFromEnvironment() {
  if (isR2StorageConfigured()) {
    return createR2StorageFromEnvironment();
  }
  if (usesLocalGenerationStorage()) {
    return createLocalImageStorageFromEnvironment();
  }
  throw new Error("Generation storage is not configured");
}

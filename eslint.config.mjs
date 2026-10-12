import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      ".benchmark-build/**",
      ".next/**",
      "benchmark-results/**",
      "node_modules/**",
      "out/**",
      "next-env.d.ts",
    ],
  },
];

export default eslintConfig;

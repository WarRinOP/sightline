import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/dist/**",
      "**/coverage/**",
      "**/next-env.d.ts",
      "data/**",
      "pipeline/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // CLAUDE.md §6: no `any` (use unknown + zod), no default exports except Next.js pages/layouts.
      "@typescript-eslint/no-explicit-any": "error",
      "no-restricted-exports": [
        "error",
        { restrictDefaultExports: { direct: true, named: true, defaultFrom: true } },
      ],
    },
  },
  {
    // Plain Node scripts run outside the TypeScript projects.
    files: ["**/*.mjs"],
    languageOptions: { globals: { process: "readonly", console: "readonly" } },
  },
  {
    // Files whose tools require a default export.
    files: ["apps/web/app/**/{page,layout,not-found,error,loading}.tsx", "**/*.config.{ts,mjs}"],
    rules: { "no-restricted-exports": "off" },
  },
);

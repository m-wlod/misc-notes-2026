import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";
import jsxA11y from "eslint-plugin-jsx-a11y";
import tseslint from "typescript-eslint";

// eslint-config-next already registers the react, react-hooks, import, jsx-a11y and
// @typescript-eslint plugins. Re-registering them throws "Cannot redefine plugin",
// so we only borrow the *rules* from the stricter presets.
const rulesOf = (configs) => Object.assign({}, ...configs.map((c) => c.rules ?? {}));

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["**/*.{ts,tsx,mts}"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      ...rulesOf(tseslint.configs.strictTypeChecked),
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/ban-ts-comment": [
        "error",
        { "ts-ignore": "allow-with-description", "ts-expect-error": "allow-with-description" },
      ],
      "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
    },
  },
  {
    rules: {
      ...jsxA11y.flatConfigs.strict.rules,
      "import/order": [
        "error",
        {
          groups: ["builtin", "external", "internal", ["parent", "sibling", "index"]],
          pathGroups: [{ pattern: "@/**", group: "internal" }],
          "newlines-between": "always",
          alphabetize: { order: "asc", caseInsensitive: true },
        },
      ],
      "import/no-default-export": "off",
    },
  },
  {
    // Config files are plain JS/TS run by tools, not part of the typed app.
    files: ["*.config.{js,mjs,ts,mts}", "eslint.config.mjs"],
    ...tseslint.configs.disableTypeChecked,
  },
  prettier,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "supabase/**",
    "next-env.d.ts",
    "src/lib/db/database.types.ts",
  ]),
]);

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
    // Design rules (docs/DESIGN.md) at lint time: no arbitrary shadows, radii, colours
    // or font sizes. Tokens only. Applies to every string, including className.
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: String.raw`Literal[value=/(^|\s|:)(shadow|drop-shadow|inset-shadow|rounded|rounded-[a-z]+)-\x5b/]`,
          message:
            "Arbitrary shadow/radius values are banned. Use the radius tokens (docs/DESIGN.md).",
        },
        {
          selector: String.raw`Literal[value=/-\x5b#/]`,
          message:
            "Arbitrary hex colours are banned. Use a colour token (bg-surface, text-ink, …).",
        },
        {
          selector: String.raw`Literal[value=/(^|\s|:)text-\x5b\d/]`,
          message: "Off-scale font sizes are banned. Use the type scale (text-2xs … text-3xl).",
        },
        {
          selector: String.raw`TemplateElement[value.raw=/(shadow|rounded)-\x5b|-\x5b#|text-\x5b\d/]`,
          message: "Arbitrary shadow/radius/colour/font-size values are banned. Use tokens.",
        },
      ],
    },
  },
  {
    rules: {
      ...jsxA11y.flatConfigs.strict.rules,
      // Scroll containers (wide tables, long equations) must be keyboard-focusable
      // (WCAG 2.1.1); they are named regions/groups, so allow tabIndex there.
      "jsx-a11y/no-noninteractive-tabindex": [
        "error",
        { tags: [], roles: ["tabpanel", "region", "group"], allowExpressionValues: true },
      ],
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
  {
    // RLS tests address tables dynamically by name, so the typed client can't follow;
    // relax only the "unsafe any" family there. Still type-checked.
    files: ["supabase/tests/**/*.ts"],
    rules: {
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-return": "off",
    },
  },
  prettier,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "supabase/functions/**",
    "supabase/.temp/**",
    "next-env.d.ts",
    "src/lib/db/database.types.ts",
  ]),
]);

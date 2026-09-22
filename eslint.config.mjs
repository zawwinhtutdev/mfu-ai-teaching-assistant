import { defineConfig, globalIgnores } from "eslint/config"
import nextVitals from "eslint-config-next/core-web-vitals"
import nextTs from "eslint-config-next/typescript"

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    ".next_*/**",
    "node_modules/**",
    "public/**",
    "reports/**",
    "scripts/**",
    ".vercel/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // The codebase predates linting; keep correctness rules on and relax style noise.
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "react-hooks/exhaustive-deps": "warn",
      "@next/next/no-img-element": "off",
      "react/no-unescaped-entities": "off",
      "prefer-const": "warn",
      // New in eslint-config-next 16 (React Compiler rules). The legacy codebase
      // has ~40 pre-existing violations; keep them visible as warnings until the
      // components are refactored.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/purity": "warn",
    },
  },
  {
    // Legacy Educve marketing template: static anchors and CommonJS hooks.
    files: ["components/educve/**", "lib/educve/**"],
    rules: {
      "@next/next/no-html-link-for-pages": "off",
      "@typescript-eslint/no-require-imports": "off",
    },
  },
])

export default eslintConfig

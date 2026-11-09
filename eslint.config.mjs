import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores(["build"]),
  {
    files: ["src/**/*.{js,jsx}"],
    extends: [js.configs.recommended, reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
    languageOptions: {
      globals: { ...globals.browser, ...globals.webextensions },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  {
    files: ["public/js/**/*.js"],
    extends: [js.configs.recommended],
    languageOptions: {
      sourceType: "script",
      globals: { ...globals.browser, ...globals.webextensions, module: "readonly", TJVolumeCore: "readonly" },
    },
    rules: { "no-unused-vars": ["error", { caughtErrors: "none" }] },
  },
  {
    files: ["scripts/**/*.js", "test/**/*.js"],
    extends: [js.configs.recommended],
    languageOptions: { sourceType: "commonjs", globals: globals.node },
  },
  {
    files: ["*.config.mjs"],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
  },
]);

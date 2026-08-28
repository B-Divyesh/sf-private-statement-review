import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist/**", "node_modules/**"]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.ts", "tests/**/*.ts", "tests/**/*.mjs"],
    languageOptions: {
      globals: {
        Blob: "readonly",
        console: "readonly",
        File: "readonly",
        FormData: "readonly",
        URL: "readonly",
        crypto: "readonly",
        document: "readonly",
        fetch: "readonly",
        history: "readonly",
        localStorage: "readonly",
        location: "readonly",
        navigator: "readonly",
        process: "readonly",
        window: "readonly"
      }
    }
  }
);

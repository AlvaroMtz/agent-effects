import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // dist/ holds the compiled copy of these same tests; collecting it
    // would run every suite twice and inflate the reported count.
    exclude: ["**/node_modules/**", "**/dist/**"],
  },
});

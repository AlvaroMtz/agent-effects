import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // dist/ holds the compiled copy of these same tests; collecting it
    // would run every suite twice and inflate the reported count.
    exclude: ["**/node_modules/**", "**/dist/**"],
    // Type-shape assertions (expectTypeOf) only bite under the typechecker,
    // so typecheck mode includes the same files the runtime suite runs.
    typecheck: {
      enabled: true,
      include: ["src/**/*.test.ts"],
    },
  },
});

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Type-shape assertions (expectTypeOf) only bite under the typechecker,
    // so typecheck mode includes the same files the runtime suite runs.
    typecheck: {
      enabled: true,
      include: ["src/**/*.test.ts"],
    },
  },
});

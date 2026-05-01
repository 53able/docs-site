import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: ["node_modules/**", "repos/**", "tmp/**"],
    include: ["scripts/**/*.test.ts"],
  },
});

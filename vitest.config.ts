import { configDefaults, defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url))
    }
  },
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    testTimeout: 20_000,
    // Keep vitest's defaults, plus skip git worktrees nested under .claude —
    // they are separate working copies and would double-run the suite.
    exclude: [...configDefaults.exclude, "**/.claude/**"]
  }
});

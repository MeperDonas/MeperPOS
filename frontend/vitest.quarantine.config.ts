import { defineConfig } from "vitest/config";
import path from "node:path";
import { quarantineRegistry } from "./quarantine";

// Watchdog config (scripts/check-quarantine.mjs): runs ONLY quarantined
// suites. `include` is derived from the typed registry (frontend/quarantine.ts)
// — the same single source of truth the default config derives `exclude` from,
// so the two cannot drift. `passWithNoTests` keeps an empty registry a silent
// exit-0 (spec R4, D4).
const quarantinedFiles = quarantineRegistry.map((entry) => entry.file);

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: false,
    setupFiles: ["./vitest.setup.ts"],
    include: quarantinedFiles,
    passWithNoTests: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});

import { defineConfig } from "vitest/config";
import path from "node:path";

// THROWAWAY config used only while restoring quarantined suites: identical to
// vitest.config.ts but WITHOUT the quarantine excludes, so the still-excluded
// suites actually execute during their RED -> GREEN fix cycle.
export default defineConfig({
  test: {
    environment: "jsdom",
    globals: false,
    setupFiles: ["./vitest.setup.ts"],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/cypress/**",
      "**/.{idea,git,cache,output,temp}/**",
      "**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});

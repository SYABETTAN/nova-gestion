import { defineConfig } from "vitest/config";
import path from "path";
import { loadEnvFile } from "node:process";

try {
  loadEnvFile(".env.test");
} catch {
  try {
    loadEnvFile(".env");
  } catch {
    // ignore
  }
}

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup/server-only.mock.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});

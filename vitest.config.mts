import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: { environment: "node", env: { TZ: "America/Sao_Paulo" }, include: ["src/**/*.test.ts", "supabase/**/*.test.ts"], testTimeout: 60000 },
});

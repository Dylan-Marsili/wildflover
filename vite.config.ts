/**
 * File: vite.config.ts
 * Author: Wildflover
 * Description: Vite configuration for Tauri application build system
 * Language: TypeScript
 */

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(async () => ({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
}));

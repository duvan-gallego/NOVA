import react from "@vitejs/plugin-react";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";

const certPath = resolve("certs/nova-dev.crt");
const keyPath = resolve("certs/nova-dev.key");
const hasHttpsCert = existsSync(certPath) && existsSync(keyPath);

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    https: hasHttpsCert
      ? {
          cert: readFileSync(certPath),
          key: readFileSync(keyPath),
        }
      : undefined,
    proxy: {
      "/ask": "http://127.0.0.1:8000",
      "/ask-text": "http://127.0.0.1:8000",
      "/health": "http://127.0.0.1:8000",
    },
  },
});

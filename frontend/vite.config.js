import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  server: {
    proxy: {
      "/reconciliation": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },

      "/payment-failures": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
      "/payment-failure-cases": {
    target: "http://localhost:5000",
    changeOrigin: true
},

      "/fraud-intelligence": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },

      "/action-orchestration": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },

      "/approval-actions": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },

      "/fraud-cases": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },

      "/cases": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
      "/refund-intelligence": {
  target: "http://localhost:5000",
  changeOrigin: true,
},

"/risk-prioritization": {
  target: "http://localhost:5000",
  changeOrigin: true,
},

"/investigate": {
  target: "http://localhost:5000",
  changeOrigin: true,
},
      "/notifications": {
  target: "http://localhost:5000",
  changeOrigin: true,
},
"/audit-logs": {
  target: "http://localhost:5000",
  changeOrigin: true,
},
    },
  },
});
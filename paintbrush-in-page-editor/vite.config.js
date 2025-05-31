import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig({
  plugins: [react()],
  base: "/in-page-editor-build/",
  server: {
    port: 3000,
  },
});

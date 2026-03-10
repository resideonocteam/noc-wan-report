import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Replace 'resideo-noc-wan' with your actual GitHub repo name
export default defineConfig({
  plugins: [react()],
  base: "/resideo-noc-wan/",
});

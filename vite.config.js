import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Replace 'solution-tracker' with your GitHub repo name
  base: "/solution-tracker/",
});

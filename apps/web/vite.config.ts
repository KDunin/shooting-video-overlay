import { defineConfig, loadEnv } from "vite";
import { devtools } from "@tanstack/devtools-vite";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";

import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";

export default ({ mode }: { mode: string }) => {
  const env = loadEnv(mode, process.cwd(), "");

  const config = defineConfig({
    resolve: {
      tsconfigPaths: true,
    },
    plugins: [
      devtools(),
      nitro({
        preset: "bun",
        routeRules: {
          "/api/**": { proxy: `${env.API_URL}/**` },
        },
      }),
      tailwindcss(),
      tanstackStart(),
      viteReact({
        babel: {
          plugins: ["babel-plugin-react-compiler"],
        },
      }),
    ],
  });

  return config;
};

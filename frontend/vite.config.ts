import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
  ],
  server: {
    proxy: {
      '/api': {
        target: 'https://thilinasir-lms-backend-git-911914734849.europe-west1.run.app',
        changeOrigin: true,
        secure: true,
        cookieDomainRewrite: 'localhost',
      },
    },
  },
})

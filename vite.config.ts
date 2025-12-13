import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, (process as any).cwd(), '');
  return {
    plugins: [react()],
    define: {
      // This is crucial: It makes 'process.env.API_KEY' work in the browser
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
      // Polyfill process for other potential uses
      'process.env': JSON.stringify(env) 
    },
  }
})
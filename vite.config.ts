import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // 加载环境变量，process.cwd() 确保路径正确
  const env = loadEnv(mode, (process as any).cwd(), '');
  return {
    plugins: [react()],
    build: {
      outDir: 'dist',
    },
    define: {
      // 关键：将 process.env.API_KEY 注入到前端代码中
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
    },
  }
})
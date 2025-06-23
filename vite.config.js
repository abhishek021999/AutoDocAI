// import { defineConfig } from 'vite'
// import react from '@vitejs/plugin-react'

// // https://vitejs.dev/config/
// export default defineConfig({
//   plugins: [react()],
//   base: '/',
//   build: {
//     outDir: 'dist',
//     assetsDir: 'assets',
//     rollupOptions: {
//       output: {
//         manualChunks: undefined
//       }
//     }
//   },
//   server: {
//     historyApiFallback: true,
//     port: 3000
//   },
//   preview: {
//     port: 3000,
//     strictPort: true,
//     host: true
//   }
// }) 

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
})
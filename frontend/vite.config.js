import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // The production UI is loaded from disk by pywebview, so assets must be
  // relative to index.html instead of pointing at the drive root.
  base: './',
  plugins: [react()],
  build: {
    // crossorigin attributes break file:// loading in WebView2/CEF
    modulePreload: false,
  },
})

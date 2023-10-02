import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import svelteSVG from 'vite-plugin-svelte-svg'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [svelte(), svelteSVG({
    svgoConfig: {}, // See https://github.com/svg/svgo#configuration
    requireSuffix: true, // Set false to accept '.svg' without the '?component'
  }), VitePWA({
    registerType: 'autoUpdate', devOptions: {
      enabled: true
    }
  })],
  optimizeDeps: {
    exclude: ['lib-graphics']
  },
})

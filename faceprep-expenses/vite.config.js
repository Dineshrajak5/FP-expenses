import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon-expenses.png', 'faceprep-logo.svg', 'faceprep-logo-dark.svg'],
      manifest: {
        name: 'FACE Prep Reimbursement Centre',
        short_name: 'FP Expenses',
        description: 'FACE Prep internal expense reimbursement portal',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          { src: '/favicon-expenses.png', sizes: '192x192', type: 'image/png' },
          { src: '/favicon-expenses.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts-cache', expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/.*/i,
            handler: 'NetworkFirst',
            options: { cacheName: 'supabase-api-cache', expiration: { maxEntries: 50, maxAgeSeconds: 60 * 5 } },
          },
        ],
      },
    }),
  ],
})

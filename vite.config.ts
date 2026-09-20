import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The real Gemini API key now lives server-side only, in the Vercel Edge
// Function at /api/gemini (see that file). It is read from the
// GEMINI_API_KEY environment variable at request time and is never sent
// to the browser.
//
// The constant below is NOT a secret — it's a harmless placeholder kept
// only so the existing `if (!process.env.API_KEY)` "is AI available"
// checks throughout services/geminiService.ts keep working unchanged.
// The actual authorization check now happens in the proxy: if the server
// is missing GEMINI_API_KEY, requests fail there and the app's existing
// error handling/fallback logic takes over, exactly as it already did
// for any other API error.
export default defineConfig(() => ({
  server: {
    open: true,
    port: 3000,
    host: '0.0.0.0',
  },
  plugins: [react()],
  define: {
    'process.env.API_KEY': JSON.stringify('proxy-enabled'),
    'process.env.GEMINI_API_KEY': JSON.stringify('proxy-enabled'),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
}));

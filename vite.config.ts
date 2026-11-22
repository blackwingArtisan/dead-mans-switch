import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { SECURITY_HEADERS } from './src/server/security';

const staticDemo = process.env.VITE_STATIC_DEMO === '1';

/** Static hosting (Cloudflare Pages): send the same security headers the server sends. */
function pagesHeaders(): Plugin {
  return {
    name: 'pages-headers',
    apply: 'build',
    generateBundle() {
      const lines = Object.entries(SECURITY_HEADERS).map(([k, v]) => `  ${k}: ${v}`);
      this.emitFile({ type: 'asset', fileName: '_headers', source: ['/*', ...lines, ''].join('\n') });
    },
  };
}

export default defineConfig({
  root: 'src/web',
  plugins: [react(), ...(staticDemo ? [pagesHeaders()] : [])],
  build: {
    outDir: '../../dist/web',
    emptyOutDir: true,
  },
  server: {
    port: 3141,
    strictPort: true,
    proxy: { '/api': 'http://localhost:3140' },
  },
});

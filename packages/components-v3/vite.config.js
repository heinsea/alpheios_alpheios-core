/**
 * Vite library-mode build for alpheios-components-v3.
 *
 * Output:
 *   dist/components-v3.js          (ESM, consumed by webextension webpack)
 *   dist/components-v3.umd.cjs     (UMD, fallback for non-ESM consumers)
 *   dist/style.css                 (extracted CSS — token + primitive styles)
 *
 * `vue` is treated as an external peer; the webextension bundles it once.
 */

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [
    {
      name: 'alpheios-raw-csv',
      enforce: 'pre',
      transform (code, id) {
        if (id.endsWith('.csv')) {
          return { code: `export default ${JSON.stringify(code)}`, map: null }
        }
      }
    },
    vue()
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('../inflection-tables/src', import.meta.url)),
      '@lib': fileURLToPath(new URL('../inflection-tables/lib', import.meta.url)),
      '@views': fileURLToPath(new URL('../inflection-tables/views', import.meta.url)),
      'alpheios-inflection-tables': fileURLToPath(new URL('../inflection-tables/index.js', import.meta.url)),
      'alpheios-data-models': fileURLToPath(new URL('../data-models/src/driver.js', import.meta.url)),
      'uuid/v4': fileURLToPath(new URL('../../node_modules/uuid/dist/esm-browser/v4.js', import.meta.url))
    }
  },
  build: {
    target: 'es2020',
    sourcemap: true,
    lib: {
      entry: fileURLToPath(new URL('./src/index.js', import.meta.url)),
      name: 'AlpheiosComponentsV3',
      fileName: (format) => format === 'es' ? 'components-v3.js' : 'components-v3.umd.cjs',
      formats: ['es', 'umd']
    },
    rollupOptions: {
      external: ['vue'],
      output: {
        globals: { vue: 'Vue' },
        // Single CSS bundle so consumers inject one file.
        assetFileNames: (assetInfo) => assetInfo.name === 'style.css' ? 'style.css' : assetInfo.name
      }
    }
  },
  server: {
    // sandbox.html is a dev-only preview page (Stage 1).
    open: '/sandbox.html'
  }
})

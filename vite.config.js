import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Sitio de varias páginas: cada .html de la raíz es una sección del panel.
export default defineConfig({
  appType: 'mpa',
  build: {
    target: 'es2022',
    rollupOptions: {
      input: {
        index: resolve(import.meta.dirname, 'index.html'),
        bandeja: resolve(import.meta.dirname, 'bandeja.html'),
        celulas: resolve(import.meta.dirname, 'celulas.html'),
        clientes: resolve(import.meta.dirname, 'clientes.html'),
      },
    },
  },
});

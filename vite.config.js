import { defineConfig } from 'vite';
export default defineConfig({
  base: './',
  build: { rollupOptions: { input: { main: 'index.html', object: 'object.html' }, output: { manualChunks: { three: ['three', 'three/addons/controls/OrbitControls.js'] } } } },
});

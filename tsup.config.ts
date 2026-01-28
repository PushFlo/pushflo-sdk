import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    server: 'src/server.ts',
    react: 'src/react.ts',
  },
  format: ['cjs', 'esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  minify: false,
  external: ['react'],
  esbuildOptions(options) {
    options.banner = {
      js: '/* @pushflo/sdk - https://pushflo.dev */',
    };
  },
});

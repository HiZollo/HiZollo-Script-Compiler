import { defineConfig } from 'tsdown';
import type { TsdownPlugin } from 'tsdown';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { minify } from 'uglify-js';

const VIRTUAL_ID = 'virtual:hzscript-bootstrap';
const RESOLVED_ID = '\0' + VIRTUAL_ID;

const bootstrapPath = fileURLToPath(new URL('./src/runtime/bootstrap.js', import.meta.url));

const bootstrapPlugin: TsdownPlugin = {
  name: 'hzscript-bootstrap',
  resolveId(id) {
    return id === VIRTUAL_ID ? RESOLVED_ID : null;
  },
  load(id) {
    if (id !== RESOLVED_ID) return null;
    this.addWatchFile(bootstrapPath);

    const result = minify(readFileSync(bootstrapPath, 'utf8'));
    if (result.error) this.error(result.error)
    if (result.code === undefined) this.error('Failed to minify Bootstrap');
    return `export default ${JSON.stringify(result.code)};`;
  }
};

export default defineConfig({
	clean: true,
	dts: true,
	entry: ['index.ts'],
	format: ['esm', 'cjs'],
	minify: true,
	sourcemap: true,
	target: 'es2021',
  deps: {
    neverBundle: true,
  },
  plugins: [bootstrapPlugin]
});

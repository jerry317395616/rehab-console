import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const project = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const output = path.resolve(
  process.argv[2] || path.join(project, '.temp', `rehab-console-${Date.now()}`),
);
await fs.mkdir(path.dirname(output), { recursive: true });
await fs.mkdir(output);
const publicRoot = path.join(output, 'rehab/public/console');
await fs.cp(path.join(project, 'dist'), publicRoot, { recursive: true });
const html = await fs.readFile(path.join(publicRoot, 'index.html'), 'utf8');
const scripts = [
  ...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/g),
].map((item) => item[1]);
const styles = [
  ...html.matchAll(/<link\b[^>]*href=["']([^"']+\.css)["'][^>]*>/g),
].map((item) => item[1]);
if (
  !scripts.length ||
  [...scripts, ...styles].some(
    (url) => !url.startsWith('/assets/rehab/console/'),
  )
) {
  throw new Error('Build contains an unexpected frontend resource origin');
}
const files = {};
async function hashFiles(directory) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (file === path.join(publicRoot, 'manifest.json')) continue;
    if (entry.isDirectory()) await hashFiles(file);
    else
      files[path.relative(publicRoot, file).replaceAll('\\', '/')] = createHash(
        'sha256',
      )
        .update(await fs.readFile(file))
        .digest('hex');
  }
}
await hashFiles(publicRoot);
await fs.writeFile(
  path.join(publicRoot, 'manifest.json'),
  JSON.stringify({ scripts, styles, files }, null, 2),
);
console.log(
  JSON.stringify({ output, scripts, styles, files: Object.keys(files).length }),
);

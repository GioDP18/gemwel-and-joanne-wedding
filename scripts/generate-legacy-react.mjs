import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const legacyDir = path.join(root, 'public', 'legacy-pages');
const outDir = path.join(root, 'src', 'legacy', 'generated', 'pages');
const manifestPath = path.join(root, 'src', 'legacy', 'generated', 'manifest.js');

fs.mkdirSync(outDir, { recursive: true });

const toComponentName = (file) => {
  const base = file.replace(/\.html$/i, '');
  const parts = base.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  const normalized = parts
    .map((p) => (/^[0-9]/.test(p) ? `N${p}` : p.charAt(0).toUpperCase() + p.slice(1)))
    .join('');
  return `${normalized || 'Page'}Page`;
};

const extract = (html, pattern) => {
  const match = html.match(pattern);
  return match ? match[1] : '';
};

const extractAll = (html, pattern) => [...html.matchAll(pattern)].map((m) => m[1]).filter(Boolean);

const esc = (s) => s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');

const files = fs
  .readdirSync(legacyDir)
  .filter((f) => f.toLowerCase().endsWith('.html'))
  .sort((a, b) => a.localeCompare(b));

const entries = [];

for (const file of files) {
  const fullPath = path.join(legacyDir, file);
  const raw = fs.readFileSync(fullPath, 'utf8');

  const body = extract(raw, /<body[^>]*>([\s\S]*?)<\/body>/i);
  const title = extract(raw, /<title>([\s\S]*?)<\/title>/i).trim();
  const styles = extractAll(raw, /<link[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi);
  const scripts = extractAll(raw, /<script[^>]*src=["']([^"']+)["'][^>]*><\/script>/gi);

  const componentName = toComponentName(file);
  const componentFile = `${file.replace(/\.html$/i, '')}.jsx`;

  const jsx = `const html = \`${esc(body)}\`;

export default function ${componentName}() {
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
`;

  fs.writeFileSync(path.join(outDir, componentFile), jsx, 'utf8');

  entries.push({ file, title, styles, scripts, componentName, componentFile });
}

const importLines = entries
  .map((e) => `import ${e.componentName} from './pages/${e.componentFile}';`)
  .join('\n');

const objectLines = entries
  .map((e) => {
    const styles = JSON.stringify(e.styles, null, 2).replace(/\n/g, '\n      ');
    const scripts = JSON.stringify(e.scripts, null, 2).replace(/\n/g, '\n      ');
    return `  ${JSON.stringify(e.file)}: {\n    title: ${JSON.stringify(e.title)},\n    styles: ${styles},\n    scripts: ${scripts},\n    Component: ${e.componentName}\n  }`;
  })
  .join(',\n');

const manifest = `${importLines}

export const legacyManifest = {
${objectLines}
};
`;

fs.writeFileSync(manifestPath, manifest, 'utf8');
console.log(`Generated ${entries.length} React page components.`);

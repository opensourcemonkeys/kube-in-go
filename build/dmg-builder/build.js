const appdmg = require('appdmg');
const path = require('path');
const fs = require('fs');

const version = process.env.VERSION;
if (!version) {
  console.error('Error: VERSION environment variable is required');
  process.exit(1);
}

const distDir = path.resolve(__dirname, '../../dist');
const output = path.join(distDir, `kube-inspector-${version}-macos-universal.dmg`);

fs.mkdirSync(distDir, { recursive: true });

console.log(`Building DMG: ${path.basename(output)}`);

const dmg = appdmg({
  source: path.resolve(__dirname, 'spec.json'),
  target: output
});

dmg.on('progress', (info) => {
  if (info.type === 'step-begin') process.stdout.write(`  • ${info.title}...\n`);
});

dmg.on('finish', () => {
  console.log(`\nCreated: dist/${path.basename(output)}`);
});

dmg.on('error', (err) => {
  console.error('DMG build failed:', err.message);
  process.exit(1);
});

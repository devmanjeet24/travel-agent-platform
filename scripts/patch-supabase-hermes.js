/**
 * Patches @supabase/supabase-js so release Hermes builds succeed.
 * Dynamic import("@opentelemetry/api") is not supported by hermesc.
 */
const fs = require('fs');
const path = require('path');

const files = [
  path.join(
    __dirname,
    '../node_modules/@supabase/supabase-js/dist/index.mjs',
  ),
  path.join(
    __dirname,
    '../node_modules/@supabase/supabase-js/dist/index.cjs',
  ),
];

const patterns = [
  /if \(otelModulePromise === null\) otelModulePromise = import\([\s\S]*?OTEL_PKG[\s\S]*?\)\.catch\(\(\) => null\);/,
  /if \(otelModulePromise === null\) otelModulePromise = Promise\.resolve\(null\);/,
];

const replacement =
  'if (otelModulePromise === null) otelModulePromise = Promise.resolve(null);';

for (const file of files) {
  if (!fs.existsSync(file)) {
    console.warn(`[patch-supabase-hermes] skip missing ${file}`);
    continue;
  }
  const source = fs.readFileSync(file, 'utf8');
  if (source.includes(replacement) && !patterns[0].test(source)) {
    continue;
  }
  const next = source.replace(patterns[0], replacement);
  if (next === source) {
    console.warn(`[patch-supabase-hermes] no changes for ${file}`);
    continue;
  }
  fs.writeFileSync(file, next);
  console.log(`[patch-supabase-hermes] patched ${path.basename(file)}`);
}

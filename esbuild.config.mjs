import * as esbuild from 'esbuild';

const isWatch = process.argv.includes('--watch');

const commonOptions = {
  bundle: true,
  minify: !isWatch,
  sourcemap: isWatch,
  target: ['chrome90'],
  format: 'esm',
};

async function build() {
  // Background script (Service Worker)
  const backgroundContext = await esbuild.context({
    ...commonOptions,
    entryPoints: ['src/background.ts'],
    outfile: 'dist/background.js',
    format: 'esm',
  });

  // Content script
  const contentContext = await esbuild.context({
    ...commonOptions,
    entryPoints: ['src/content/index.ts'],
    outfile: 'dist/content.js',
    format: 'iife', // Content scripts need IIFE format
  });

  if (isWatch) {
    console.log('Watching for changes...');
    await Promise.all([
      backgroundContext.watch(),
      contentContext.watch(),
    ]);
  } else {
    await Promise.all([
      backgroundContext.rebuild(),
      contentContext.rebuild(),
    ]);
    await Promise.all([
      backgroundContext.dispose(),
      contentContext.dispose(),
    ]);
    console.log('Build complete!');
  }
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});

import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import sharp from 'sharp';
import { observeMesh } from './analyze-portable.ts';

const run = promisify(execFile);

test('visible face contour yields a recommendation input and flags strong side turns', () => {
  const mesh = [];
  const left = [127, 234, 93, 132, 58, 172, 136, 150, 149, 176, 148];
  const right = [356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377];
  const outline = [[168,185], [160,210], [162,235], [168,260], [179,280], [195,300], [212,318], [232,335], [251,351], [269,367], [285,390]];
  for (const [index, [x, y]] of outline.entries()) {
    mesh[left[index]] = [x, y];
    mesh[right[index]] = [600 - x, y];
  }
  mesh[152] = [300,400];
  mesh[33] = [218,210];
  mesh[133] = [264,210];
  mesh[263] = [382,210];
  mesh[362] = [336,210];
  mesh[1] = [305,268];
  const result = observeMesh(mesh, 600, 600);
  assert.equal(result.status, 'ready');
  assert.equal(result.vertical, 'balanced');
  assert.equal(result.jaw, 'tapered');

  mesh[1] = [365,268];
  assert.equal(observeMesh(mesh, 600, 600).status, 'retake');
});

test('the bundled analyzer runs offline and asks for a retake when no face is present', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'jqq-portrait-test-'));
  try {
    const file = path.join(directory, 'blank photo.png');
    await sharp({ create: { width: 500, height: 600, channels: 3, background: '#b3b0a7' } }).png().toFile(file);
    const script = fileURLToPath(new URL('./analyze-portable.ts', import.meta.url));
    const noFetch = 'data:text/javascript,' + encodeURIComponent("globalThis.fetch = () => { throw new Error('Unexpected network fetch'); };");
    const { stdout } = await run(process.execPath, ['--import', 'tsx', '--import', noFetch, script, file], { timeout: 20000, windowsHide: true });
    const result = JSON.parse(stdout.trim());
    assert.equal(result.status, 'retake');
    assert.match(result.advice, /未识别到清楚的脸部/);
    assert.deepEqual(Object.keys(result).sort(), ['advice', 'status']);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

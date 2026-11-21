import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Human as HumanEngine } from '@vladmandic/human';
import type { io } from '@tensorflow/tfjs-core';
import sharp from 'sharp';
import type { Analysis } from './model';

type Observation = Pick<Analysis, 'status' | 'advice' | 'vertical' | 'jaw'>;
type Point = [number, number, number?];
const modelPrefix = 'jqq-local-model://portrait/';
const require = createRequire(import.meta.url);
const faceEdge = [127, 234, 93, 132, 58, 172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365, 397, 288, 361, 323, 454, 356];
const photoAdvice = '这张照片的脸部偏小、明显侧转或裁切较紧。建议平视镜头，让头顶、双耳和下巴都入镜。';

function retake(advice: string): Observation {
  return { status: 'retake', advice };
}

export function observeMesh(mesh: Point[], width: number, height: number): Observation {
  const points = [...faceEdge, 33, 133, 263, 362, 1].map(index => mesh[index]);
  if (!points.every(point => point && Number.isFinite(point[0]) && Number.isFinite(point[1])
    && point[0] > width * 0.015 && point[0] < width * 0.985
    && point[1] > height * 0.015 && point[1] < height * 0.985)) return retake(photoAdvice);

  const eyeLeft = average(mesh[33], mesh[133]);
  const eyeRight = average(mesh[263], mesh[362]);
  const eyes = average(eyeLeft, eyeRight);
  const roll = Math.atan2(eyeRight[1] - eyeLeft[1], eyeRight[0] - eyeLeft[0]);
  if (Math.abs(roll) > 0.24) return retake(photoAdvice);

  const upright = ([x, y]: Point): Point => [
    (x - eyes[0]) * Math.cos(roll) + (y - eyes[1]) * Math.sin(roll),
    (y - eyes[1]) * Math.cos(roll) - (x - eyes[0]) * Math.sin(roll),
  ];
  const edge = faceEdge.map(index => upright(mesh[index]));
  const left = Math.min(...edge.map(point => point[0]));
  const right = Math.max(...edge.map(point => point[0]));
  const top = Math.min(...edge.map(point => point[1]));
  const bottom = upright(mesh[152])[1];
  const span = bottom - top;
  const faceWidth = right - left;
  const noseX = upright(mesh[1])[0];
  if (span <= 0 || bottom <= 0 || faceWidth < 90
    || Math.abs(noseX - (left + right) / 2) > faceWidth * 0.18) return retake(photoAdvice);

  const upper = crossSection(edge, bottom - span * 0.77);
  const lower = crossSection(edge, bottom - span * 0.35);
  const ratio = bottom / faceWidth;
  return {
    status: 'ready',
    advice: '当前正面照可以用于观察可见轮廓。试剪前还要核实发旋、原生纹理和头发的实际落点。',
    vertical: ratio > 0.87 ? 'longer' : ratio < 0.65 ? 'wider' : 'balanced',
    jaw: upper && lower ? (lower / upper < 0.85 ? 'tapered' : 'soft') : 'unknown',
  };
}

function average(a: Point, b: Point): Point {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

function crossSection(edge: Point[], y: number) {
  const intersections = edge.slice(1).flatMap((end, index) => {
    const start = edge[index];
    const low = Math.min(start[1], end[1]);
    const high = Math.max(start[1], end[1]);
    if (y < low || y >= high) return [];
    return [start[0] + (y - start[1]) * (end[0] - start[0]) / (end[1] - start[1])];
  });
  if (intersections.length === 2) return Math.abs(intersections[1] - intersections[0]);
}

async function makeEngine(): Promise<HumanEngine> {
  const entry = path.join(path.dirname(require.resolve('@vladmandic/human')), 'human.node-wasm.js');
  const { Human } = require(entry) as { Human: typeof HumanEngine };
  const models = path.resolve(path.dirname(entry), '../models');
  const wasm = path.dirname(require.resolve('@tensorflow/tfjs-backend-wasm'));
  const human = new Human({
    backend: 'wasm',
    wasmPath: wasm.replaceAll('\\', '/') + '/',
    modelBasePath: modelPrefix,
    cacheModels: false,
    cacheSensitivity: 0,
    filter: { enabled: false, return: false },
    face: {
      enabled: true, detector: { maxDetected: 2, minConfidence: 0.55, rotation: true },
      mesh: { enabled: true, keepInvalid: true },
      iris: { enabled: false }, description: { enabled: false }, emotion: { enabled: false },
    },
    body: { enabled: false }, hand: { enabled: false }, gesture: { enabled: false },
  });
  const tfio: typeof io = human.tf.io;
  // Route only these packaged model names to disk. No HTTP or global fetch override is needed.
  const loadBundleModel = (url: string | string[]): io.IOHandler | null => {
    if (typeof url !== 'string' || !url.startsWith(modelPrefix)) return null;
    const filename = url.slice(modelPrefix.length);
    if (filename !== 'blazeface.json' && filename !== 'facemesh.json') return null;
    return {
      async load() {
        const { weightsManifest, ...manifest } = JSON.parse(await readFile(path.join(models, filename), 'utf8')) as io.ModelJSON;
        const weights = await readFile(path.join(models, filename.replace('.json', '.bin')));
        return {
          ...manifest,
          weightSpecs: weightsManifest.flatMap(group => group.weights),
          weightData: new Uint8Array(weights).buffer,
        };
      },
    };
  };
  // TensorFlow's router dispatcher accepts null for an unmatched scheme.
  tfio.registerLoadRouter(loadBundleModel as Parameters<typeof tfio.registerLoadRouter>[0]);
  await human.load();
  const loaded = human.models.loaded();
  if (!loaded.includes('blazeface') || !loaded.includes('facemesh') || human.tf.getBackend() !== 'wasm') {
    throw new Error('The bundled portrait models could not be loaded.');
  }
  return human;
}

async function analyzePhoto(file: string): Promise<Observation> {
  const pixels = await sharp(file, { limitInputPixels: 48_000_000 })
    .autoOrient().resize({ width: 1100, height: 1100, fit: 'inside', withoutEnlargement: true })
    .toColourspace('srgb').removeAlpha().raw().toBuffer({ resolveWithObject: true })
    .catch(() => null);
  if (!pixels || pixels.info.channels !== 3) return retake('这张照片无法读取，请换用清晰的正面照片。');
  const { width, height } = pixels.info;
  const human = await makeEngine();
  const tensor = human.tf.tensor4d(new Uint8Array(pixels.data), [1, height, width, 3], 'int32');
  try {
    const result = await human.detect(tensor);
    if (result.error) throw new Error('The bundled portrait detector failed.');
    if (result.face.length > 1) return retake('画面里有多张脸，请使用单人的正面照片。');
    if (!result.face.length) return retake('未识别到清楚的脸部，请换一张平视正面照。');
    const [face] = result.face;
    if (!face.mesh || face.mesh.length < 468
      || Math.abs(face.rotation?.angle.yaw ?? 0) >= 0.38
      || Math.abs(face.rotation?.angle.pitch ?? 0) >= 0.45) return retake(photoAdvice);
    return observeMesh(face.mesh, width, height);
  } finally {
    tensor.dispose();
  }
}

if (process.argv[2] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  analyzePhoto(process.argv[2]).then(result => {
    process.stdout.write(JSON.stringify(result) + '\n');
  }).catch(() => {
    process.stderr.write('Local portrait analysis failed.\n');
    process.exitCode = 1;
  });
}

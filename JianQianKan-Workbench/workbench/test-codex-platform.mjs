import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { checkCodex, codexEnvironment, codexExecutablePaths, codexImage } from './codex-image.ts';

test('discovers the official Windows installer and both Windows x64 npm layouts', () => {
  const candidates = codexExecutablePaths({
    platform: 'win32',
    arch: 'x64',
    env: {
      Path: '"C:\\工具 & 应用\\bin";C:\\项目\\node_modules\\.bin;.;relative;\\root-relative',
      LocalAppData: 'C:\\Users\\User\\AppData\\Local',
      AppData: 'C:\\Users\\User\\AppData\\Roaming',
    },
  });

  assert.equal(candidates[0], 'C:\\工具 & 应用\\bin\\codex.exe');
  assert.ok(candidates.includes('C:\\Users\\User\\AppData\\Local\\Programs\\OpenAI\\Codex\\bin\\codex.exe'));
  const appScope = 'C:\\Users\\User\\AppData\\Roaming\\npm\\node_modules\\@openai';
  assert.ok(candidates.includes(`${appScope}\\codex-win32-x64\\vendor\\x86_64-pc-windows-msvc\\bin\\codex.exe`));
  assert.ok(candidates.includes(`${appScope}\\codex\\vendor\\x86_64-pc-windows-msvc\\codex\\codex.exe`));
  assert.ok(candidates.includes('C:\\项目\\node_modules\\@openai\\codex-win32-x64\\vendor\\x86_64-pc-windows-msvc\\bin\\codex.exe'));
  assert.ok(candidates.every(file => /^[A-Z]:\\/i.test(file) && file.endsWith('.exe')));
});

test('discovers nested Windows ARM64 npm binaries and validates explicit executable overrides', () => {
  const host = { platform: 'win32', arch: 'arm64', env: { Path: 'D:\\npm' } };
  const candidates = codexExecutablePaths(host);
  assert.ok(candidates.includes('D:\\npm\\node_modules\\@openai\\codex\\node_modules\\@openai\\codex-win32-arm64\\vendor\\aarch64-pc-windows-msvc\\bin\\codex.exe'));
  assert.ok(!candidates.some(file => file.includes('win32-x64')));

  const binary = 'D:\\剪前 & 看看\\codex.exe';
  assert.deepEqual(codexExecutablePaths({ ...host, env: { jqq_codex_executable: binary } }), [binary]);
  for (const invalid of ['codex.exe', 'D:\\npm\\codex.cmd', '\\root-relative.exe']) {
    assert.throws(() => codexExecutablePaths({ ...host, env: { JQQ_CODEX_EXECUTABLE: invalid } }), { status: 503 });
  }
});

test('keeps macOS app discovery first and drops relative search paths', () => {
  const candidates = codexExecutablePaths({ platform: 'darwin', arch: 'arm64', env: { PATH: '/opt/bin::./bin' } });
  assert.ok(candidates[0].startsWith('/Applications/ChatGPT.app/'));
  assert.deepEqual(candidates.slice(1), ['/opt/bin/codex']);
});

test('delivers canonical Windows profile variables and excludes model API keys', () => {
  const env = codexEnvironment({
    platform: 'win32',
    arch: 'x64',
    env: {
      Path: 'C:\\工具 & 应用\\bin',
      UserProfile: 'C:\\Users\\Example',
      APPDATA: 'C:\\Roaming',
      localappdata: 'C:\\Local',
      SystemRoot: 'C:\\Windows',
      TEMP: 'C:\\Temp',
      codex_home: 'C:\\Codex profile',
      OPENAI_API_KEY: 'fixture-key',
      APIMART_API_KEY: 'fixture-key',
      JQQ_CODEX_EXECUTABLE: 'C:\\Other\\codex.exe',
    },
  });
  assert.deepEqual(env, {
    PATH: 'C:\\工具 & 应用\\bin', USERPROFILE: 'C:\\Users\\Example', APPDATA: 'C:\\Roaming',
    LOCALAPPDATA: 'C:\\Local', SystemRoot: 'C:\\Windows', TEMP: 'C:\\Temp', CODEX_HOME: 'C:\\Codex profile',
  });
});

test('invokes and verifies a native child with Unicode paths through login and artifact collection', async t => {
  const root = await fs.mkdtemp(path.join(tmpdir(), 'jqq-codex-'));
  const previousDir = process.cwd();
  const previousHome = process.env.CODEX_HOME;
  const previousExecutable = process.env.JQQ_CODEX_EXECUTABLE;
  t.after(async () => {
    process.chdir(previousDir);
    if (previousHome === undefined) delete process.env.CODEX_HOME;
    else process.env.CODEX_HOME = previousHome;
    if (previousExecutable === undefined) delete process.env.JQQ_CODEX_EXECUTABLE;
    else process.env.JQQ_CODEX_EXECUTABLE = previousExecutable;
    await fs.rm(root, { recursive: true, force: true });
  });

  const profile = path.join(root, '登录 & 生图');
  const caseDir = path.join(root, '理发 & 案例');
  const input = path.join(caseDir, '正面 & 参考.png');
  const thread = 'e61e3610-0917-4a9a-9dd2-f8e9fa40fd3c';
  const fileName = 'exec-e25d7a6c-726b-4a77-a13c-9a5bd7788a13.png';
  const prompt = '测试 stdin 与字面量 $HOME & %USERPROFILE%';
  await fs.mkdir(caseDir);
  await fs.writeFile(input, 'fixture');
  // Node is the native test executable. The scripts stand in for its login and exec subcommands.
  await fs.writeFile(path.join(root, 'login'), `
    require('node:assert/strict').equal(process.argv[2], 'status');
    require('node:assert/strict').equal(process.env.CODEX_HOME, ${JSON.stringify(profile)});
    console.log('Logged in using ChatGPT');
  `);
  await fs.writeFile(path.join(root, 'exec'), `
    const assert = require('node:assert/strict');
    const fs = require('node:fs');
    const path = require('node:path');
    assert.equal(process.argv[process.argv.indexOf('--cd') + 1], ${JSON.stringify(caseDir)});
    assert.equal(process.argv[process.argv.indexOf('--image') + 1], ${JSON.stringify(input)});
    assert.equal(fs.readFileSync(0, 'utf8'), ${JSON.stringify(prompt)});
    const directory = path.join(process.env.CODEX_HOME, 'generated_images', ${JSON.stringify(thread)});
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, ${JSON.stringify(fileName)}), Buffer.alloc(5000));
    console.log(JSON.stringify({ type: 'thread.started', thread_id: ${JSON.stringify(thread)} }));
    console.log(JSON.stringify({ type: 'turn.completed' }));
  `);
  process.chdir(root);
  process.env.CODEX_HOME = profile;
  process.env.JQQ_CODEX_EXECUTABLE = process.execPath;

  const executable = await checkCodex();
  const result = await codexImage(executable, { directory: caseDir, input: [input], prompt }, new AbortController().signal);
  assert.equal(result.sessionId, thread);
  assert.equal(result.fileName, fileName);
  assert.equal(result.path, await fs.realpath(path.join(profile, 'generated_images', thread, fileName)));
});

import assert from 'node:assert/strict';
import { mkdtemp, mkdir, realpath, rm, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { lifecycleArgs, parseForkProfile, resolveVerifiedScratchPath } from '../src/fork-profile.js';

function profile() {
  return {
    schemaVersion: 1,
    namespace: 'fork-example',
    dataDir: '.tmp/test-data',
    toolsDevRoot: '.tmp/test-runtime',
    nodeExecutable: '.tmp/node/bin/node',
    daemonPort: 49784,
    webPort: 49785,
    buildRevision: 'a'.repeat(40),
    hashes: Object.fromEntries(['apps/daemon/src/mcp.ts', 'apps/daemon/src/server.ts',
      'apps/daemon/dist/mcp.js', 'apps/daemon/dist/server.js'].map(file => [file, 'b'.repeat(64)])),
  };
}

test('resolves an explicit fork profile into its own checkout scratch', () => {
  const value = parseForkProfile(profile(), '/checkout');
  assert.equal(value.dataDir, '/checkout/.tmp/test-data');
  assert.equal(value.toolsDevRoot, '/checkout/.tmp/test-runtime');
  assert.equal(value.buildRevision, 'a'.repeat(40));
});

test('targets the web app so profile stop halts both daemon and web', () => {
  const args = lifecycleArgs(parseForkProfile(profile(), '/checkout'), 'stop', 'web');
  assert.deepEqual(args.slice(0, 3), ['tools-dev', 'stop', 'web']);
  assert.equal(args.includes('all'), false);
});

for (const key of ['dataDir', 'toolsDevRoot', 'nodeExecutable']) test(`rejects ${key} outside the isolated checkout`, () => {
  assert.throws(() => parseForkProfile({ ...profile(), [key]: '../production' }, '/checkout'), /isolated scratch/);
  assert.throws(() => parseForkProfile({ ...profile(), [key]: '.tmp/../../production' }, '/checkout'), /isolated scratch/);
});

for (const namespace of ['default', 'release-stable', '../fork-escape']) test(`rejects a shared or escaping namespace ${namespace}`, () => {
  assert.throws(() => parseForkProfile({ ...profile(), namespace }, '/checkout'), /fork- namespace/);
});

test('rejects missing build identity and overlapping ports', () => {
  assert.throws(() => parseForkProfile({ ...profile(), hashes: {} }, '/checkout'), /nonempty string/);
  assert.throws(() => parseForkProfile({ ...profile(), buildRevision: 'HEAD' }, '/checkout'), /complete commit SHA/);
  assert.throws(() => parseForkProfile({ ...profile(), webPort: 49784 }, '/checkout'), /must differ/);
});

test('allows first start to create missing runtime roots without following escaping symlinks', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'fork-profile-root-'));
  const outside = await mkdtemp(path.join(os.tmpdir(), 'fork-profile-outside-'));
  try {
    assert.equal(await resolveVerifiedScratchPath('.tmp/fresh/data', 'dataDir', root, true), path.join(await realpath(root), '.tmp/fresh/data'));
    await assert.rejects(resolveVerifiedScratchPath('.tmp/fresh/data', 'dataDir', root), { code: 'ENOENT' });

    await mkdir(path.join(root, '.tmp'), { recursive: true });
    await symlink(outside, path.join(root, '.tmp', 'escape'));
    await assert.rejects(resolveVerifiedScratchPath('.tmp/escape/new-runtime', 'toolsDevRoot', root, true), /isolated scratch/);
  } finally {
    await Promise.all([rm(root, { recursive: true, force: true }), rm(outside, { recursive: true, force: true })]);
  }
});

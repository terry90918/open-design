import assert from 'node:assert/strict';
import { test } from 'vitest';
import { parseForkProfile } from '../../../scripts/open-design-fork.ts';

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

test.each(['dataDir', 'toolsDevRoot', 'nodeExecutable'])('rejects %s outside the isolated checkout', key => {
  assert.throws(() => parseForkProfile({ ...profile(), [key]: '../production' }, '/checkout'), /isolated scratch/);
  assert.throws(() => parseForkProfile({ ...profile(), [key]: '.tmp/../../production' }, '/checkout'), /isolated scratch/);
});

test.each(['default', 'release-stable', '../fork-escape'])('rejects a shared or escaping namespace %s', namespace => {
  assert.throws(() => parseForkProfile({ ...profile(), namespace }, '/checkout'), /fork- namespace/);
});

test('rejects missing build identity and overlapping ports', () => {
  assert.throws(() => parseForkProfile({ ...profile(), hashes: {} }, '/checkout'), /nonempty string/);
  assert.throws(() => parseForkProfile({ ...profile(), buildRevision: 'HEAD' }, '/checkout'), /complete commit SHA/);
  assert.throws(() => parseForkProfile({ ...profile(), webPort: 49784 }, '/checkout'), /must differ/);
});

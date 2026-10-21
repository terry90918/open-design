import { createHash } from 'node:crypto';
import { execFile, spawn } from 'node:child_process';
import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { McpSessionClient } from './mcp-session-client.ts';

const exec = promisify(execFile);
const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const digestFiles = ['apps/daemon/src/mcp.ts', 'apps/daemon/src/server.ts', 'apps/daemon/dist/mcp.js', 'apps/daemon/dist/server.js'] as const;
type DigestFile = typeof digestFiles[number];
export type ForkProfile = {
  namespace: string;
  dataDir: string;
  toolsDevRoot: string;
  nodeExecutable: string;
  daemonPort: number;
  webPort: number;
  buildRevision: string;
  hashes: Record<DigestFile, string>;
};

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requiredString(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} must be a nonempty string`);
  return value;
}

function scratchPath(value: unknown, name: string, root: string): string {
  const resolved = path.resolve(root, requiredString(value, name));
  const relative = path.relative(path.join(root, '.tmp'), resolved);
  if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`${name} must stay inside this checkout's isolated scratch`);
  }
  return resolved;
}

function port(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1024 || value > 65535) {
    throw new Error(`${name} must be an unprivileged TCP port`);
  }
  return value;
}

export function parseForkProfile(value: unknown, root = workspace): ForkProfile {
  if (!record(value) || value.schemaVersion !== 1) throw new Error('Expected fork profile schemaVersion 1');
  const namespace = requiredString(value.namespace, 'namespace');
  if (!/^fork-[a-z0-9-]+$/.test(namespace)) throw new Error('Use an explicit fork- namespace');
  const daemonPort = port(value.daemonPort, 'daemonPort');
  const webPort = port(value.webPort, 'webPort');
  if (daemonPort === webPort) throw new Error('Daemon and web ports must differ');
  const revision = requiredString(value.buildRevision, 'buildRevision');
  if (!/^[a-f0-9]{40}$/.test(revision)) throw new Error('buildRevision must be a complete commit SHA');
  const hashes = value.hashes;
  if (!record(hashes)) throw new Error('Expected build hashes');
  const result = Object.fromEntries(digestFiles.map(file => {
    const hash = requiredString(hashes[file], file);
    if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error(`Invalid SHA-256 for ${file}`);
    return [file, hash];
  }));
  return {
    namespace,
    daemonPort,
    webPort,
    dataDir: scratchPath(value.dataDir, 'dataDir', root),
    toolsDevRoot: scratchPath(value.toolsDevRoot, 'toolsDevRoot', root),
    nodeExecutable: scratchPath(value.nodeExecutable, 'nodeExecutable', root),
    buildRevision: revision,
    hashes: result as Record<DigestFile, string>,
  };
}

async function verify(profile: ForkProfile): Promise<void> {
  for (const [name, location] of Object.entries({ dataDir: profile.dataDir, toolsDevRoot: profile.toolsDevRoot, nodeExecutable: profile.nodeExecutable })) {
    scratchPath(await realpath(location), name, await realpath(workspace));
  }
  for (const file of digestFiles) {
    const actual = createHash('sha256').update(await readFile(path.join(workspace, file))).digest('hex');
    if (actual !== profile.hashes[file]) throw new Error(`Build drift at ${file}; rebuild and review the profile explicitly`);
  }
  await exec('git', ['merge-base', '--is-ancestor', profile.buildRevision, 'HEAD'], { cwd: workspace });
  const { stdout } = await exec(profile.nodeExecutable, ['--version']);
  if (!/^v24\./.test(stdout.trim())) throw new Error('Profile requires an existing Node 24 executable');
}

function environment(profile: ForkProfile): NodeJS.ProcessEnv {
  return {
    ...process.env,
    PATH: `${path.dirname(profile.nodeExecutable)}${path.delimiter}${process.env.PATH ?? ''}`,
    OD_DATA_DIR: profile.dataDir,
    OD_HOST: '127.0.0.1',
  };
}

async function lifecycle(profile: ForkProfile, action: 'start' | 'status' | 'stop', app = 'web'): Promise<unknown> {
  const args = [path.join(workspace, 'tools/dev/bin/tools-dev.mjs'), action, app,
    '--namespace', profile.namespace, '--tools-dev-root', profile.toolsDevRoot, '--no-env-file', '--json'];
  if (action === 'start') args.push('--daemon-port', String(profile.daemonPort), '--web-port', String(profile.webPort));
  const { stdout } = await exec(profile.nodeExecutable, args, { cwd: workspace, env: environment(profile), maxBuffer: 1024 * 1024 });
  return JSON.parse(stdout);
}

async function ready(profile: ForkProfile): Promise<void> {
  for (const [app, port] of [['daemon', profile.daemonPort], ['web', profile.webPort]] as const) {
    const state = await lifecycle(profile, 'status', app);
    if (!record(state) || state.state !== 'running' || state.url !== `http://127.0.0.1:${port}`) {
      throw new Error(`Expected ${app} is not running; use this launcher's start command first`);
    }
  }
}

function mcpArgs(profile: ForkProfile): string[] {
  return [path.join(workspace, 'apps/daemon/dist/cli.js'), 'mcp', '--daemon-url', `http://127.0.0.1:${profile.daemonPort}`];
}

function transport(profile: ForkProfile) {
  return spawn(profile.nodeExecutable, mcpArgs(profile), {
    cwd: workspace,
    env: environment(profile),
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

async function main(): Promise<void> {
  const [profileFlag, filename, action] = process.argv.slice(2);
  if (profileFlag !== '--profile' || !filename || !['start', 'status', 'stop', 'check', 'stdio'].includes(action ?? '')) {
    throw new Error('Usage: node scripts/open-design-fork.ts --profile <reviewed-profile.json> <start|status|stop|check|stdio>');
  }
  const profile = parseForkProfile(JSON.parse(await readFile(filename, 'utf8')));
  await verify(profile);
  if (action === 'start' || action === 'status' || action === 'stop') {
    console.log(JSON.stringify(await lifecycle(profile, action), null, 2));
    return;
  }
  await ready(profile);
  if (action === 'stdio') {
    const child = spawn(profile.nodeExecutable, mcpArgs(profile), {cwd: workspace, env: environment(profile), stdio: 'inherit'});
    const forward = (signal: NodeJS.Signals) => child.kill(signal);
    const interrupt = () => forward('SIGINT');
    const terminate = () => forward('SIGTERM');
    process.on('SIGINT', interrupt);
    process.on('SIGTERM', terminate);
    try {
      process.exitCode = await new Promise<number>((resolve, reject) => {
        child.once('error', reject);
        child.once('close', (code) => resolve(code ?? 1));
      });
    } finally {
      process.off('SIGINT', interrupt);
      process.off('SIGTERM', terminate);
    }
    return;
  }
  const child = transport(profile);
  if (!child.stdin || !child.stdout || !child.stderr) throw new Error('Expected piped MCP transport');
  const client = await McpSessionClient.connect(child);
  try {
    const catalog = await client.request('tools/list', {});
    if (!record(catalog) || !Array.isArray(catalog.tools)) throw new Error('Missing MCP catalog');
    const generation = catalog.tools.find((tool: unknown) => record(tool) && tool.name === 'start_run');
    if (!record(generation) || !record(generation.inputSchema) || !record(generation.inputSchema.properties)
      || !record(generation.inputSchema.properties.reasoning) || generation.inputSchema.properties.reasoning.type !== 'string') {
      throw new Error('Fork reasoning capability is missing');
    }
    const projects = await client.callTool('list_projects', {});
    if (projects.isError) throw new Error('Fork project discovery failed');
    console.log(JSON.stringify({ buildRevision: profile.buildRevision, namespace: profile.namespace,
      projectScope: 'isolated fork data only', tools: catalog.tools.length, reasoning: true, projects }, null, 2));
  } finally {
    await client.close();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

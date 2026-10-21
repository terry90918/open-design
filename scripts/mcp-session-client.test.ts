import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import test from 'node:test';
import { McpSessionClient } from './mcp-session-client.ts';

const server = `
const readline = require('node:readline');
let workflow;
readline.createInterface({ input: process.stdin }).on('line', line => {
  const message = JSON.parse(line);
  if (!('id' in message)) return;
  const reply = result => process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:message.id,result})+'\\n');
  if (message.method === 'initialize') return reply({protocolVersion:'2024-11-05',capabilities:{}});
  if (message.method === 'tools/list') return reply({tools:[]});
  const {name,arguments:args} = message.params;
  if (name === 'collect') { workflow = 'session-owned'; return reply({workflow}); }
  if (name === 'lookup') return reply({isError:args.workflow !== workflow});
  if (name === 'wait') return;
  if (name === 'exit') return process.exit(0);
  if (name === 'protocol-error') return process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:message.id,error:{code:-32602,message:'invalid'}})+'\\n');
  process.stdout.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/progress',params:{}})+'\\n');
  setTimeout(() => reply(args), args.delay || 0);
});
`;

async function connect() {
  return McpSessionClient.connect(spawn(process.execPath, ['-e', server], { stdio: ['pipe', 'pipe', 'pipe'] }));
}

test('workflow remains owned by one live session; a replacement cannot reuse it', async () => {
  const client = await connect();
  const replacement = await connect();
  try {
    const draft = await client.callTool('collect', {});
    assert.deepEqual(await replacement.callTool('lookup', draft), { isError: true });
    assert.deepEqual(await client.callTool('lookup', draft), { isError: false });
  } finally {
    await Promise.all([client.close(), replacement.close()]);
  }
});

test('correlates concurrent responses while ignoring notifications', async () => {
  const client = await connect();
  try {
    const results = await Promise.all([
      client.callTool('echo', { value: 'first', delay: 20 }),
      client.callTool('echo', { value: 'second' }),
    ]);
    assert.equal(results[0].value, 'first');
    assert.equal(results[1].value, 'second');
  } finally {
    await client.close();
  }
});

test('timeout has uncertain outcome and does not retry or replace the session', async () => {
  const client = await connect();
  try {
    await assert.rejects(client.callTool('wait', {}, 20), /outcome is uncertain; no retry was sent/);
    assert.deepEqual(await client.callTool('echo', { alive: true }), { alive: true });
  } finally {
    await client.close();
  }
});

test('process exit rejects pending calls promptly', async () => {
  const client = await connect();
  try {
    await assert.rejects(client.callTool('exit', {}), /MCP process closed/);
  } finally {
    await client.close();
  }
});

test('protocol errors remain distinct from tool error results', async () => {
  const client = await connect();
  try {
    await assert.rejects(client.callTool('protocol-error', {}), /-32602: invalid/);
    assert.deepEqual(await client.callTool('lookup', { workflow: 'missing' }), { isError: true });
  } finally {
    await client.close();
  }
});

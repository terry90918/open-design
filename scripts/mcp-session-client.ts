import { execFile, spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface } from 'node:readline';
import { promisify } from 'node:util';

type JsonValue = string | number | boolean | null | JsonValue[] | JsonObject;
type JsonObject = { [key: string]: JsonValue };
type Pending = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

function json(value: unknown): value is JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(json);
  return object(value) && Object.values(value).every(json);
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export class McpSessionClient {
  #process: ChildProcessWithoutNullStreams;
  #pending = new Map<number, Pending>();
  #nextId = 0;
  #closed = false;

  private constructor(process: ChildProcessWithoutNullStreams) {
    this.#process = process;
    createInterface({ input: process.stdout }).on('line', line => {
      let message: unknown;
      try {
        message = JSON.parse(line);
      } catch {
        this.#fail(new Error('Invalid JSON from MCP process'));
        return;
      }
      if (!object(message) || typeof message.id !== 'number') return;
      const pending = this.#pending.get(message.id);
      if (!pending) return;
      this.#pending.delete(message.id);
      clearTimeout(pending.timer);
      if (object(message.error)) {
        pending.reject(new Error(`${message.error.code}: ${message.error.message}`));
      } else {
        pending.resolve(message.result);
      }
    });
    process.stderr.resume();
    process.on('error', error => this.#fail(error));
    process.on('close', () => this.#fail(new Error('MCP process closed; pending outcome is uncertain')));
    process.stdin.on('error', error => this.#fail(error));
  }

  static async connect(process: ChildProcessWithoutNullStreams): Promise<McpSessionClient> {
    const client = new McpSessionClient(process);
    try {
      await client.request('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'open-design-session-diagnostic', version: '1.0' },
      });
      client.#send({ jsonrpc: '2.0', method: 'notifications/initialized' });
      return client;
    } catch (error) {
      await client.close();
      throw error;
    }
  }

  #send(value: JsonObject): void {
    if (this.#closed) throw new Error('MCP session is closed');
    this.#process.stdin.write(`${JSON.stringify(value)}\n`);
  }

  #fail(error: Error): void {
    this.#closed = true;
    for (const pending of this.#pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.#pending.clear();
  }

  request(method: string, params: JsonObject, timeoutMs = 20_000): Promise<unknown> {
    if (this.#closed) return Promise.reject(new Error('MCP session is closed'));
    const id = ++this.#nextId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pending.delete(id);
        reject(new Error(`${method} timed out; outcome is uncertain; no retry was sent`));
      }, timeoutMs);
      this.#pending.set(id, { resolve, reject, timer });
      try {
        this.#send({ jsonrpc: '2.0', id, method, params });
      } catch (error) {
        clearTimeout(timer);
        this.#pending.delete(id);
        reject(error);
      }
    });
  }

  async callTool(name: string, args: JsonObject, timeoutMs?: number): Promise<JsonObject> {
    const result = await this.request('tools/call', { name, arguments: args }, timeoutMs);
    if (!json(result) || result === null || typeof result !== 'object' || Array.isArray(result)) {
      throw new Error('MCP tool result must be a JSON object');
    }
    return result;
  }

  async close(): Promise<void> {
    this.#fail(new Error('MCP session closed by caller'));
    if (this.#process.exitCode !== null || this.#process.signalCode !== null) return;
    await new Promise<void>(resolve => {
      const timer = setTimeout(() => this.#process.kill('SIGKILL'), 1_000);
      this.#process.once('close', () => {
        clearTimeout(timer);
        resolve();
      });
      this.#process.kill();
    });
  }
}

export async function connectRegisteredOpenDesign(): Promise<McpSessionClient> {
  const { stdout } = await promisify(execFile)('codex', ['mcp', 'get', 'open-design', '--json']);
  const registration: unknown = JSON.parse(stdout);
  if (object(registration) && registration.enabled === false) {
    throw new Error('Existing Open Design registration is disabled');
  }
  const transport = object(registration) ? registration.transport : null;
  if (!object(transport) || transport.type !== 'stdio' || typeof transport.command !== 'string'
    || !Array.isArray(transport.args) || !transport.args.every(arg => typeof arg === 'string')) {
    throw new Error('Expected existing Open Design stdio registration');
  }
  const env: NodeJS.ProcessEnv = { ...process.env };
  if (object(transport.env)) {
    for (const [key, value] of Object.entries(transport.env)) {
      if (typeof value === 'string') env[key] = value;
    }
  }
  return McpSessionClient.connect(spawn(transport.command, transport.args, {
    env,
    stdio: ['pipe', 'pipe', 'pipe'],
  }));
}

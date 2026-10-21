# MCP session diagnostics

This fork adds an opt-in diagnostic client, not a daemon or desktop fix. It uses the existing `codex mcp get open-design --json` stdio registration without changing it. It does not install software, select an execution mode, collect a brief, start a run, retry a timed-out request, or print registration environment values automatically.

## Keep a workflow on one connection

Import `connectRegisteredOpenDesign` from `scripts/mcp-session-client.ts`, connect once, and retain the returned client through brief collection, confirmation, agent discovery, project selection, run creation, and polling. Close it in `finally` after terminal delivery or an explicit boundary. Call only advertised tools with their current schemas.

A timeout means the outcome is uncertain. The client never resends the request or opens another connection automatically. For a generation retry, the caller must retain the original byte-identical arguments and request identifier, inspect the previous outcome, and follow the installed plugin's workflow rules. Do not persist brief nonces or signed envelopes in source control.

The unaccepted workflow and brief draft are session-owned. In the installed runtime 0.25.0, collecting a brief on one connection and using its workflow on a second connection returned a missing-workflow error. The original live connection accepted the same discovery request. This reproduces a diagnostic caller lifecycle mistake; it does not demonstrate an upstream daemon bug.

## Local tests

Use the repository's required Node 24 runtime:

```sh
node --experimental-strip-types --test scripts/mcp-session-client.test.ts
```

The tests use subprocess fixtures, never the user's design projects. They cover workflow ownership across connections, interleaved replies and notifications, uncertain timeouts without automatic retry, child exit, and protocol errors versus tool error results.

A real read-only smoke check can connect once, call `request('tools/list', {})`, then call an advertised read-only tool, and close the same client. The caller must have permission to access the installed local service. Do not interpret this result as native tool injection, write permission, authentication, quota, or generation success.

## Model and reasoning investigation

Baseline source: `3b0df90f305c8279e748c292accf336d02b924ef` (package 0.25.1). Installed signed runtime: 0.25.0; its prebundled implementation was checked separately for the relevant mapping and reasoning fallback.

- MCP `start_run` advertises a model selector and service tier, but no reasoning selector. Additional properties are rejected. `apps/daemon/src/mcp.ts` forwards model and service tier into the run request, without forwarding reasoning.
- `apps/daemon/src/server.ts` selects the explicit requested model before the stored model preference. It validates an explicitly supplied reasoning value, otherwise uses null; it does not copy the stored reasoning preference into this path.
- `apps/daemon/src/runtimes/defs/codex.ts` emits the CLI `model_reasoning_effort` override only for a supplied reasoning value. The app-server session similarly supplies `turn/start` effort only when present (`apps/daemon/src/agent-protocol/codex-app-server/session.ts`). Without it, CLI configuration/default resolution applies.
- Read-only observations: Open Design's Codex preference was model `gpt-6-luna`, reasoning `medium`. Its configured Codex environment map was empty. The ordinary CLI root model reasoning effort was `low`. Model `gpt-6.1-sol` was advertised by agent discovery; Codex CLI version was 0.162.1 and its harmless login-status command reported an existing ChatGPT login.

The stored UI preference alone therefore cannot establish that an MCP-started run uses medium. No run was started to claim an effective engine configuration. Inherited daemon environment, project configuration, and model-specific defaults can affect CLI resolution; those are not proved by reading the root preference. No settings, credentials, or trust state were changed to force a result.

## Source change awaiting runtime validation

The fork now adds an optional `reasoning` string to the MCP `start_run` schema and forwards a nonempty value to the existing run request reasoning field. No shared DTO, HTTP API, CLI adapter, default preference, or security setting is changed. Existing API/runtime reasoning support is reused; CLI surface parity does not require a new command for this MCP-only forwarding change.

There is no global enum: runtime/model options differ and can be discovered dynamically. The existing runner remains responsible for validating the selected runtime/model effort. An omitted or empty string is not forwarded; explicit `default` is forwarded for the existing runner/adapter default handling. Existing callers therefore retain their previous behavior.

Nine focused regression cases were added to `apps/daemon/tests/mcp-runs.test.ts`: optional string schema and runtime-boundary acceptance, four non-string rejection cases, forwarding medium/default, and omitted/empty default preservation. These are authored tests, not reported as executed or passing. They must run with the installed dependency toolchain before the branch is ready:

```sh
pnpm --filter @open-design/daemon exec vitest run -c vitest.config.ts tests/mcp-runs.test.ts
pnpm guard
pnpm typecheck
```

The changed source and test files passed Node 24 syntax-only `--experimental-strip-types --check` and `git diff --check`. These checks neither resolve imports nor typecheck code. A model/effort acceptance check and disposable Local Codex generation remain pending on an isolated runtime. This change does not fix missing host tool injection.

Executing a custom runtime requires a separately reviewed isolated-build plan: supported Node/pnpm and dependencies, namespaced disposable data, separate ports, no MCP re-registration, no replacement of the signed installation, and no changes to trust or security permissions. No custom build was installed or started for this investigation. Approval for isolated dependencies/build/runtime execution remains pending.

## Validation limits

Five client tests passed on the installed Helper's existing Node 24.15.0 carrier. A live registered-MCP smoke passed using this client: initialize, tools/list (22 tools), and advertised read-only list_agents on the same connection. Discovery returned Codex CLI 0.162.1 and 10 current model entries, including gpt-6.1-sol; it did not include an authentication-status field. The earlier harmless login-status check is separate evidence and does not establish quota or generation success. Full repository `pnpm guard`, `pnpm typecheck`, and daemon Vitest have not run: dependencies and pnpm are absent. This branch is diagnostic work in progress, not a ready upstream product fix.

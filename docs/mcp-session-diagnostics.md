# MCP session diagnostics

This fork adds an opt-in diagnostic client and an optional MCP reasoning selector. It does not fix native host tool injection or desktop automation. It uses the existing `codex mcp get open-design --json` stdio registration without changing it. It does not install software, select an execution mode, collect a brief, start a run, retry a timed-out request, or print registration environment values automatically.

## Keep a workflow on one connection

Import `connectRegisteredOpenDesign` from `scripts/mcp-session-client.ts`, connect once, and retain the returned client through brief collection, confirmation, agent discovery, project selection, run creation, and polling. Close it in `finally` after terminal delivery or an explicit boundary. Call only advertised tools with their current schemas.

A timeout means the outcome is uncertain. The client never resends the request or opens another connection automatically. For a generation retry, the caller must retain the original byte-identical arguments and request identifier, inspect the previous outcome, and follow the installed plugin's workflow rules. Do not persist brief nonces or signed envelopes in source control.

The unaccepted workflow and brief draft are session-owned. In the installed runtime 0.25.0, collecting a brief on one connection and using its workflow on a second connection returned a missing-workflow error. The original live connection accepted the same discovery request. This reproduces a diagnostic caller lifecycle mistake; it does not demonstrate an upstream daemon bug.

## Local tests

Use the repository's required Node 24 runtime:

```sh
pnpm --filter @open-design/e2e test tests/scripts/mcp-session-client.test.ts
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

## Source change and compatibility

The fork now adds an optional `reasoning` string to the MCP `start_run` schema and forwards a nonempty value to the existing run request reasoning field. No shared DTO, HTTP API, CLI adapter, default preference, or security setting is changed. Existing API/runtime reasoning support is reused; CLI surface parity does not require a new command for this MCP-only forwarding change.

There is no global enum: runtime/model options differ and can be discovered dynamically. The existing runner remains responsible for validating the selected runtime/model effort. An omitted or empty string is not forwarded; explicit `default` is forwarded for the existing runner/adapter default handling. Existing callers therefore retain their previous behavior.

Eleven focused MCP regression cases were added to `apps/daemon/tests/mcp-runs.test.ts`: optional string schema and runtime-boundary acceptance, four non-string rejection cases, forwarding medium/high/xhigh/default, and omitted/empty default preservation. The MCP suite, CLI config-argument suite, and app-server typed-parameter suite passed together (139 tests). The moved client suite passed separately (5 tests). The following checks also passed with isolated official Node 24.15.0 and pnpm 10.33.2:

```sh
pnpm --filter @open-design/daemon exec vitest run -c vitest.config.ts tests/mcp-runs.test.ts
pnpm guard
pnpm typecheck
```

The changed source and test files also passed syntax-only checks and `git diff --check`. The full repository typecheck passed, followed by a focused e2e typecheck after moving the client suite to its required location. This change does not fix missing host tool injection.

Executing a custom runtime requires a separately reviewed isolated-build plan: supported Node/pnpm and dependencies, namespaced disposable data, separate ports, no MCP re-registration, no replacement of the signed installation, and no changes to trust or security permissions. The user subsequently approved isolated dependency/build/runtime execution. The source runtime was started through tools-dev in a fresh namespace with separate data and ports. It did not replace the signed application or modify existing MCP registration, trust, or security settings.

## Validation limits

Five client tests initially passed on the installed Helper's existing Node 24.15.0 carrier and subsequently passed in the repository e2e Vitest lane. A live registered-MCP smoke passed using this client: initialize, tools/list (22 tools), and advertised read-only list_agents on the same connection. Discovery returned Codex CLI 0.162.1 and 10 current model entries, including gpt-6.1-sol; it did not include an authentication-status field. The earlier harmless login-status check is separate evidence and does not establish quota or generation success. Full repository `pnpm guard` and `pnpm typecheck`, focused daemon Vitest, and the client e2e fixture suite passed after approved isolated dependency installation. Native host tool injection remains outside this change.

## Signed-runtime disposable acceptance

The existing signed runtime 0.25.0 completed one attributed Local Codex counter generation on 2026-10-21. The run used explicit model `gpt-6.1-sol`, reached succeeded with exit 0 in about 32 seconds, and produced one `index.html`. The artifact was read through advertised `get_artifact` with workflow attribution: 2,627 bytes, untruncated, SHA-256 `21e682af641e0dd996009e273c57f4442f16f43354946f76ab96346846979d47`.

Mac Chrome verification passed initial zero, click increment/reset, Enter/Space activation, Tab focus, visible 3px focus outline, and polite live-region semantics. At 390 pixels, document and body scroll widths both measured 390; buttons measured 148 by 48 pixels. The temporary viewport override was cleared. No existing product design was changed.

The run diagnostics record the requested model but explicitly mark resolved model and reasoning as not collected. The ordinary CLI root effort was low. A separate read-only `model/list` query to the installed CLI reported Sol 6.1 support for low, medium, high, xhigh, max, and ultra, with low as its default. These observations do not replace per-run effective-engine evidence.

The source regression matrix now includes medium/high/xhigh in MCP forwarding, CLI config overrides, and app-server turn parameters. Isolated build/dependency execution was subsequently approved and completed; the parameter witnesses below record its results. The already completed signed-runtime generation is not restarted for those parameter tests.


## Live patched-runner parameter witnesses

The compiled patched MCP advertised the new optional string. On the tools-dev daemon, three disposable direct-MCP regression requests traversed the actual run route, runner validation, and app-server adapter. The repository's existing fake Codex CLI captured `turn/start` model `gpt-6.1-sol` and the matching effort for each case. All three reached succeeded. The fake runtime used its own empty CLI home; no provider account or real model was invoked for these parameter cases.

| Requested effort | Captured CLI effort | Run |
| --- | --- | --- |
| medium | medium | 03bbf709-0d3d-4552-8722-aef4721a0649 |
| high | high | 919c1ca6-2028-4c07-86e0-0309c15b72b9 |
| xhigh | xhigh | a4b844f1-c791-4e41-8983-54859feeda12 |

The first integration assertion incorrectly expected a top-level reasoning field; the advertised diagnostic field is `executionDiagnostics.environment.reasoning.value`. The already completed medium run was inspected and retained, not restarted. xhigh initially hit an existing project-name cache after creation and returned no matching project before any run existed. A fresh connection verified the existing project and submitted that pending case; completed runs were not repeated. That resolver-cache behavior is outside this reasoning patch.

The first guard identified a test-layout violation; client coverage was moved into `e2e/tests/scripts/` and revalidated. The first focused suite identified fixture cache interference from the new tests; those cases now use UUID project references and preserve the pre-existing name-resolution oracle. These corrections changed tests only.

The test runtime is disposable; retain curated results and stop only its tools-dev namespace. The signed-runtime artifact and the source patch remain separate deliverables. A captured fake-CLI effort proves parameter transport, not high-effort model quality or a new production installation.

## Real generation through this fork

A subsequent explicitly requested acceptance used the fork's own MCP, daemon, and runner with the real installed Codex CLI, not the signed production runtime or a fake CLI. It completed brief confirmation, one explicit Sol 6.1/low run, terminal polling, untruncated artifact readback, Mac Chrome interaction, reload, and interaction after reload. See [fork real Local Codex acceptance](fork-local-codex-acceptance.md) for the exact execution commit, binary/source identities, run, artifact hash, browser observations, and the protected CLI-log evidence boundary.

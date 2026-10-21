# Operating the reviewed fork

`scripts/open-design-fork.ts` is a manual, checkout-bound launcher. It supports `start`, `status`, `stop`, `check`, and `stdio` with an explicitly supplied local profile. It never installs dependencies, rebuilds silently, changes MCP registration, starts at login, migrates projects, or generates content automatically.

The reviewed private profile is not committed. It specifies the existing Node 24 executable, a fork namespace, distinct loopback ports, isolated daemon data and lifecycle roots, the build commit, and SHA-256 values for both source and compiled MCP/runner files. Paths must remain in this checkout's isolated scratch and are checked after symlink resolution. Build drift fails closed. Data roots follow the [daemon data directory contract](../AGENTS.md#daemon-data-directory-contract).

Use the existing Node 24 path and reviewed profile supplied in the local handoff:

```sh
"$FORK_NODE" --experimental-strip-types scripts/open-design-fork.ts --profile "$FORK_PROFILE" start
"$FORK_NODE" --experimental-strip-types scripts/open-design-fork.ts --profile "$FORK_PROFILE" check
"$FORK_NODE" --experimental-strip-types scripts/open-design-fork.ts --profile "$FORK_PROFILE" stdio
```

`start` uses the official tools-dev lifecycle with the profile namespace, ports, and data root. It reuses an already running matching namespace. `check` verifies daemon and web status, initializes the fork MCP, confirms reasoning support, and reads the project's catalog. `stdio` requires that reviewed runtime to be running and relays the fork MCP for a native MCP client. Stopping a client does not stop the daemon. To stop the reviewed runtime, use this launcher's `stop` action explicitly.

There is no silent production fallback. The signed application and its existing `open-design` registration remain separate. The fork profile sees only its own projects. Existing production projects have not been migrated or exposed to the fork. Do not point two daemons at the same production data root. Retain the checkout and its ignored runtime data while using this profile; cleaning or archiving ignored scratch without a backup would lose that data. This launcher is an operational source-checkout route, not a packaged application replacement.

## Verified local native MCP path

On 2026-10-21, installed Codex CLI 0.162.1 started a standalone public app-server with a temporary `mcp_servers.open-design-fork` configuration. Its documented `mcpServerStatus/list` request was scoped to that server, without a thread id. It returned 22 tools, `toolsError: null`, and the fork's optional reasoning schema. `runtimeStatus` was null; this is inventory discovery, not proof of a tool-enabled live model turn. No model turn or permanent registration was created. No denied desktop application or protected session metadata was accessed.

The initial probe tried adding enabled-only overrides for plugin-provided server names. That produced an invalid-transport config error before initialization; those partial overrides were removed. The successful request was explicitly scoped to the fork server. There was no authorization denial or persistent configuration mutation in this probe.

The launcher also passed eight profile-boundary cases, scripts typechecking, e2e typechecking, repository guard, live `check`, and live idempotent `start` (created false for both existing services). A sandboxed lifecycle status can report idle when local IPC/process discovery is unavailable; this is not evidence that the host runtime stopped. Run this entry from the user's normal Mac terminal or through an approved host execution surface. Do not disable sandbox protections to make it work.

## Host injection boundary

The current task's official metadata reports `hostId: durable`; its callable native tool catalog has no Open Design tools. Its local executor can reach the fork, but that does not change the coordinator's tool catalog. The available host tools do not expose a current-task MCP reload operation.

[Official MCP documentation](https://learn.chatgpt.com/docs/extend/mcp?surface=cli) distinguishes local host configuration from hosted plugin tools. Local CLI/IDE/desktop clients share configuration on the same host; hosted conversations do not read local Codex config, and local MCP transports may be unavailable with cloud orchestration. The documentation does not establish that every durable task can bridge local stdio. A fork daemon cannot add tools to the current host catalog.

[Official public app-server documentation](https://learn.chatgpt.com/docs/app-server) describes MCP inventory and config reload methods for clients that own that app-server connection. This task does not have an authorized connection to the desktop app's controlling server. Do not use private IPC, protected logs, or the denied GUI to obtain one.

## Optional persistent registration: approval required

The minimal native local-client integration is a separate `open-design-fork` STDIO registration using the reviewed Node, this launcher, `--profile`, and `stdio`. Leave the existing `open-design` server unchanged. A concrete local registration proposal and rollback command are supplied with the handoff, but are not executed automatically.

After explicit approval, add only that entry with the official `codex mcp add` command, read it back, then inspect `/mcp` in a genuine local CLI session. For a desktop local host, the user can open Settings > MCP servers and use its Restart control. This task cannot operate that denied application. Registering locally is not a promise that this already-running durable conversation will hot-load the server.

Rollback removes only `open-design-fork` with `codex mcp remove open-design-fork`. It does not delete projects or stop either application. A production-data migration or signed-app replacement needs a separate concrete backup/owner-switch plan and approval; neither is part of this minimal registration.

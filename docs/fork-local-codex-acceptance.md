# Fork real Local Codex acceptance

This is a real generation through the fork, separate from both the earlier signed-runtime acceptance and the fake-CLI parameter regressions.

## Execution identity

Execution commit: `4980bf1709b84bb2d7a82ee8d223c1fd0514d7b2`, branch `codex/mcp-local-workflow`, source package version `0.25.1`. The daemon was rebuilt successfully from that commit with isolated official Node `24.15.0` and pnpm `10.33.2` before starting this run.

| Layer | Actual entry / evidence |
| --- | --- |
| MCP | Node executes this checkout's `apps/daemon/dist/cli.js mcp --daemon-url` against the test daemon; the registered signed MCP is not used |
| MCP schema | Live discovery advertises optional `reasoning: string` |
| Daemon lifecycle | `pnpm tools-dev start web`, namespace `fork-real-20261021`, fresh disposable data, automatic env-file loading disabled |
| Runner | This checkout's `apps/daemon/src/sidecar/index.ts` and `apps/daemon/src/server.ts` |
| Model CLI | Real installed Codex CLI `0.162.1`; harmless login-status command reports an existing ChatGPT login |
| Fake overrides | Fresh test config has no `agentCliEnv` entries and no stored Codex model preferences |
| Listeners | Independently observed Node listeners `127.0.0.1:49784` and `127.0.0.1:49785` |
| Child transport | Run start event records `codex-app-server`, requested `gpt-6.1-sol`, reasoning `low`, and a cwd inside the fresh test project's data root |

The daemon data root follows the repository's [daemon data directory contract](../AGENTS.md#daemon-data-directory-contract). It is separate from the signed installation and the previous fake-CLI test namespace. No installed application, existing MCP registration, trust state, or security permission was changed.

Build identity:

| File | SHA-256 |
| --- | --- |
| `apps/daemon/dist/mcp.js` | `effa07acc229c77c0cf93d1b5cbfaf8bbb629fd5aaedd68c9f0b6cfff1521a57` |
| `apps/daemon/dist/server.js` | `868fa1b0d54087b5899e9f0dab510e9d77cb6f0360fc5db4c84d3ca50a77982b` |
| `apps/daemon/src/mcp.ts` | `8bdcf06b83d941edab9387d7eb7b48f6411345725a8d49ff2eaaafdf50407841` |
| `apps/daemon/src/server.ts` | `a5d4e4f56483509cf4d21fff2030c4f5e0862b02df4940d833f6a7702e4a7ee9` |

## One attributed generation

A fresh persistent MCP session collected a new brief and confirmed the user's previously approved web/core-flow/wireframe answers. The same issued workflow was carried through real agent discovery, project creation, a single `start_run`, polling, and artifact readback. A new stable request identifier and the full exact arguments were saved to ignored scratch before submission; no generation retry was issued.

- Project: `od-fork-real-counter-20261021`.
- Run: `d0098923-2825-499a-9df9-1ff7405fd1e5`.
- Terminal: succeeded, exit 0, 28,267 ms, one `index.html` artifact.
- Artifact version: `46982da5-56e0-447c-bd7f-4a136eb037d5`.
- Readback: attributed `get_artifact`, untruncated, 2,228 bytes.
- File SHA-256: `c97f210e2a4405268d7d78287732841226b79995351aed9a5495e7b3dc09befe`.

The file contains the unique marker `OD-FORK-REAL-20261021`, native Increase/Reset buttons, polite live output, visible focus styling, and inline CSS/JS. It has no external resources, dependency installation, or code comments. No existing design was used or changed.

## Mac Chrome acceptance

The Studio's first navigation exceeded its 10-second browser wait while Next compiled the route for 20.9 seconds. Listing tabs confirmed that the same navigation had completed; the existing tab was reused instead of opening another Studio tab. This was an uncertain navigation outcome that was checked, not an authorization denial.

The exact run-returned preview was opened on the user's Mac Chrome:

1. Initial count 0; click Increase -> 1.
2. Enter on Increase -> 2; Space -> 3.
3. Tab moves focus to Reset; Enter resets to 0.
4. Increase -> 1; reload returns the same title and marker with count 0.
5. After reload, Increase -> 1 and Reset -> 0 still work.
6. A fresh screenshot shows the fork-specific title, marker, controls, and zero value. Studio and preview tabs were marked as deliverables.

The fork test services remain available on their loopback ports for inspection. These links last only for that test runtime session:

- Studio: <http://127.0.0.1:49785/projects/od-fork-real-counter-20261021/conversations/cbf9d7f9-8356-4c02-9c28-ed740550045c/files/index.html>
- Preview: <http://127.0.0.1:49784/api/projects/od-fork-real-counter-20261021/raw/index.html>

Stop only namespace `fork-real-20261021` through tools-dev with its recorded test runtime root when inspection is finished. Do not stop or modify the signed installation.

## Evidence limits

The real run's execution diagnostics record requested model `gpt-6.1-sol` and reasoning `low`; its run start event agrees. These values are actual runner configuration, not instructions embedded in the prompt. The provider-resolved model is explicitly not collected by this runtime.

An additional attempt to read only the correlated CLI rollout's turn metadata was rejected by automatic approval review because CLI session logs are protected. No session contents were read, and no alternative interface or path was used to bypass that denial. Independent CLI-effective metadata therefore remains unverified. The generation itself used the real CLI and completed successfully through the fork.

The earlier 139 daemon tests, 5 client tests, repository guard, and full typecheck cover the same production-code revision. The separate medium/high/xhigh live runner witnesses used a fake CLI to avoid unnecessary high-effort model calls; they are not substituted for this real low-effort generation. Native host tool injection and replacing the signed application remain outside this acceptance result.

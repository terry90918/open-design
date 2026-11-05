import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const workspaceRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const ciWorkflowPath = join(workspaceRoot, ".github", "workflows", "ci.yml");
const runnerConfigPath = join(workspaceRoot, ".github", "config", "runners.json");

type CiWorkflow = {
  permissions: Record<string, string>;
  jobs: Record<string, {
    "runs-on"?: string;
    needs?: string[];
    steps?: Array<{ name?: string; env?: Record<string, string> }>;
  }>;
};

type RunnerConfig = {
  profiles: Record<string, string[]>;
  modes: Record<string, Record<string, string>>;
};

describe("CI runner routing", () => {
  it("routes fork-targeted PR and merge-queue validation to hosted profiles", async () => {
    const workflow = parse(await readFile(ciWorkflowPath, "utf8")) as CiWorkflow;
    const runners = workflow.jobs.runners;
    const selector = runners?.["runs-on"] ?? "";
    const resolver = runners?.steps?.find((step) => step.name === "Resolve runner profiles");
    const runnerMode = resolver?.env?.OD_CI_RUNNER_MODE ?? "";

    expect(selector).toContain("github.event_name == 'pull_request'");
    expect(selector).toContain("github.event.repository.fork");
    expect(selector).toContain("github.event.pull_request.head.repo.full_name != github.repository");
    expect(selector).toContain("github.event_name == 'merge_group'");
    expect(selector).toContain("'ubuntu-24.04'");
    expect(runnerMode).toContain("github.event.repository.fork");
    expect(runnerMode).toContain("'economic'");

    expect(workflow.jobs.plan?.needs).toContain("runners");
    expect(JSON.stringify(runners)).not.toContain("secrets.");
    expect(workflow.permissions).toEqual({
      actions: "read",
      contents: "read",
      "pull-requests": "read",
    });
  });

  it("maps every economic runner class to a GitHub-hosted profile", async () => {
    const config = JSON.parse(await readFile(runnerConfigPath, "utf8")) as RunnerConfig;
    const hostedLabels = new Set(["ubuntu-24.04", "windows-latest"]);

    const economicProfiles = config.modes.economic ?? {};
    expect(Object.keys(economicProfiles).length).toBeGreaterThan(0);

    for (const [runnerClass, profile] of Object.entries(economicProfiles)) {
      expect(
        config.profiles[profile]?.some((label) => hostedLabels.has(label)),
        `economic profile for ${runnerClass}`,
      ).toBe(true);
    }
  });
});

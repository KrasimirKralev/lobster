import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { parse } from "yaml";

test("release workflow validates dated and undated changelog sections", () => {
	const workflow = parse(readFileSync(".github/workflows/lobster-npm-release.yml", "utf8"));
	const directory = mkdtempSync(path.join(tmpdir(), "lobster-release-changelog-"));
	try {
		for (const jobName of ["preflight_lobster_npm", "publish_lobster_npm"]) {
			const step = workflow.jobs[jobName].steps.find(
				(entry) => entry.name === "Validate changelog entry for release version",
			);
			assert.ok(step, jobName);
			const script = step.run.match(/node - <<'NODE'\n([\s\S]*?)\nNODE/);
			assert.ok(script, `${jobName} Node validator`);
			for (const [changelog, expected] of [
				["## 2026.9.7 - 2026-09-07\n\n- A fix.\n", 0],
				["## 2026.9.7\n\n- A fix.\n", 0],
				["## 2026.9.70 - 2026-09-07\n\n- Another version.\n", 1],
				["## 2026.9.7 - 2026-09-07\n\n## 2026.9.5\n\n- An older fix.\n", 1],
			] as const) {
				writeFileSync(path.join(directory, "CHANGELOG.md"), changelog);
				const result = spawnSync(process.execPath, ["-"], {
					input: script[1],
					cwd: directory,
					env: { PATH: process.env.PATH, TMPDIR: process.env.TMPDIR, RELEASE_TAG: "v2026.9.7" },
					encoding: "utf8",
					timeout: 10_000,
				});
				assert.equal(result.status, expected, `${jobName}: ${result.stderr}`);
			}
		}
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

/**
 * Usage:
 *   npm run test:workflow
 */

import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

import {
  basenameFromUrl,
  boundedSlug,
  buildRunbook,
  hasHeadMeta,
  matchesScope,
  normalizeDocPath,
  parseArgs,
  pathFromStatusLine,
  resolveSourcePath,
  slugify,
} from "./visual-doc-workflow.ts";

describe("visual-doc-workflow pure helpers", () => {
  it("parses command options", () => {
    expect(parseArgs(["prepare", "--url", "https://github.com/example/demo.git", "--name", "demo-doc"])).toEqual({
      command: "prepare",
      options: {
        url: "https://github.com/example/demo.git",
        name: "demo-doc",
      },
    });
  });

  it("extracts clone names from HTTPS and SSH URLs", () => {
    expect(basenameFromUrl("https://github.com/example/system-design-primer.git")).toBe("system-design-primer");
    expect(basenameFromUrl("git@github.com:example/system-design-primer.git")).toBe("system-design-primer");
  });

  it("normalizes documentation input forms to docs/*.html", () => {
    expect({
      slug: normalizeDocPath("system-design").slug,
      relativePath: normalizeDocPath("system-design").relativePath,
    }).toEqual({
      slug: "system-design",
      relativePath: "docs/system-design.html",
    });
    expect(normalizeDocPath("system-design.html").relativePath).toBe("docs/system-design.html");
    expect(normalizeDocPath("docs/system-design.html").relativePath).toBe("docs/system-design.html");
  });

  it("rejects documentation paths outside docs root", () => {
    expect(() => normalizeDocPath("../index")).toThrow(/directly under docs/u);
    expect(() => normalizeDocPath("docs/../index")).toThrow(/directly under docs/u);
    expect(() => normalizeDocPath("nested/system-design")).toThrow(/directly under docs/u);
  });

  it("creates bounded slugs and allows explicit overrides", () => {
    expect(slugify("Next AI Draw IO")).toBe("next-ai-draw-io");
    expect(boundedSlug("one-two-three-four-five")).toBe("one-two-three-four");
    expect(boundedSlug("one-two-three-four-five", "better-name")).toBe("better-name");
  });

  it("resolves source paths under repos", () => {
    expect(resolveSourcePath({ source: "system-design-primer" }).relativePath).toBe("repos/system-design-primer");
    expect(resolveSourcePath({ source: "repos/system-design-primer" }).relativePath).toBe("repos/system-design-primer");
  });

  it("matches review scope files", () => {
    expect(matchesScope("docs/system-design.html", "docs/system-design.html")).toBe(true);
    expect(matchesScope("index.html", "docs/system-design.html")).toBe(true);
    expect(matchesScope("CONTEXT.md", "docs/system-design.html")).toBe(true);
    expect(matchesScope(".gitignore", "docs/system-design.html")).toBe(true);
    expect(matchesScope("package.json", "docs/system-design.html")).toBe(true);
    expect(matchesScope("package-lock.json", "docs/system-design.html")).toBe(true);
    expect(matchesScope("tsconfig.json", "docs/system-design.html")).toBe(true);
    expect(matchesScope("vitest.config.ts", "docs/system-design.html")).toBe(true);
    expect(matchesScope("docs/adr/0001-workflow-cli-coordinates.md", "docs/system-design.html")).toBe(true);
    expect(matchesScope("docs/design-docs/visual-doc-workflow.md", "docs/system-design.html")).toBe(true);
    expect(matchesScope("scripts/visual-doc-workflow.ts", "docs/system-design.html")).toBe(true);
    expect(matchesScope("README.md", "docs/system-design.html")).toBe(false);
  });

  it("parses changed paths from git status output", () => {
    expect(pathFromStatusLine(" M scripts/visual-doc-workflow.ts")).toBe("scripts/visual-doc-workflow.ts");
    expect(pathFromStatusLine("?? README.md")).toBe("README.md");
    expect(pathFromStatusLine("R  old.md -> docs/new.md")).toBe("docs/new.md");
  });

  it("checks required meta tags inside head only", () => {
    const html = `<!doctype html>
<html>
<head>
  <meta property="og:title" content="Title">
  <meta property="og:url" content="https://example.com">
  <meta property="og:description" content="Description">
  <meta name="twitter:card" content="summary">
</head>
<body>missing-marker</body>
</html>`;
    const bodyOnly = `<!doctype html><html><head></head><body>og:title twitter:card</body></html>`;

    expect(hasHeadMeta(html, "og:title")).toBe(true);
    expect(hasHeadMeta(html, "og:url")).toBe(true);
    expect(hasHeadMeta(html, "og:description")).toBe(true);
    expect(hasHeadMeta(html, "twitter:card")).toBe(true);
    expect(hasHeadMeta(bodyOnly, "og:title")).toBe(false);
    expect(hasHeadMeta(bodyOnly, "twitter:card")).toBe(false);
  });

  it("builds a runbook with the authoring handoff", () => {
    const runbook = buildRunbook({
      source: {
        absolutePath: "/workspace/repos/system-design-primer",
        relativePath: "repos/system-design-primer",
        cloneName: "system-design-primer",
        acquiredBy: "fast-forward",
      },
      doc: {
        slug: "system-design-primer",
        relativePath: "docs/system-design-primer.html",
      },
      inventory: "=== SCAN: repos/system-design-primer ===",
    });

    expect(runbook).toMatch(/Source Repository: `repos\/system-design-primer`/u);
    expect(runbook).toMatch(/Visual Documentation Page: `docs\/system-design-primer.html`/u);
    expect(runbook).toMatch(/## Authoring Handoff/u);
    expect(runbook).toMatch(/npx tsx scripts\/visual-doc-workflow.ts validate --doc system-design-primer/u);
    expect(runbook).toMatch(/- `\.gitignore`/u);
    expect(runbook).toMatch(/- `package\.json`/u);
    expect(runbook).toMatch(/- `package-lock\.json`/u);
    expect(runbook).toMatch(/- `tsconfig\.json`/u);
    expect(runbook).toMatch(/- `vitest\.config\.ts`/u);
  });

  it("runs validate through tsx and emits stable JSON", () => {
    const result = spawnSync("npx", ["tsx", "scripts/visual-doc-workflow.ts", "validate", "--doc", "pi-mono"], {
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/"ok": true/u);
    expect(result.stdout).toMatch(/"doc": "docs\/pi-mono.html"/u);
  });

  it("rejects invalid doc paths through tsx", () => {
    const result = spawnSync("npx", ["tsx", "scripts/visual-doc-workflow.ts", "validate", "--doc", "../index"], {
      encoding: "utf8",
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/directly under docs/u);
  });
});

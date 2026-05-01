#!/usr/bin/env -S npx tsx
/**
 * Visual documentation workflow CLI.
 *
 * Usage:
 *   npm run docs:prepare -- --source <repos/name|name> [--doc <slug>]
 *   npm run docs:prepare -- --url <github-url> [--name <clone-name>] [--doc <slug>]
 *   npm run docs:validate -- --doc <slug|slug.html|docs/slug.html>
 *
 * Direct:
 *   npx tsx scripts/visual-doc-workflow.ts prepare --source <repos/name|name> [--doc <slug>]
 *   npx tsx scripts/visual-doc-workflow.ts prepare --url <github-url> [--name <clone-name>] [--doc <slug>]
 *   npx tsx scripts/visual-doc-workflow.ts validate --doc <slug|slug.html|docs/slug.html>
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Command } from "commander";
import prompts = require("prompts");
import { z } from "zod";

const InteractiveModeSchema = z.enum(["prepare", "validate"]);
const InteractiveSourceModeSchema = z.enum(["source", "url"]);
const CliOptionsSchema = z
  .object({
    doc: z.string().optional(),
    name: z.string().optional(),
    source: z.string().optional(),
    url: z.string().optional(),
  })
  .strict();
const ParsedArgsSchema = z.object({
  command: z.string().optional(),
  options: CliOptionsSchema,
});
const InteractiveAnswersSchema = z
  .object({
    doc: z.string().trim().optional(),
    mode: InteractiveModeSchema.optional(),
    name: z.string().trim().optional(),
    source: z.string().trim().optional(),
    sourceMode: InteractiveSourceModeSchema.optional(),
    url: z.string().trim().optional(),
  })
  .strict();
const SourceRepositorySchema = z.object({
  absolutePath: z.string(),
  relativePath: z.string(),
  cloneName: z.string(),
  acquiredBy: z.enum(["clone", "fast-forward"]).optional(),
  pullOutput: z.string().optional(),
});
const DocumentPathSchema = z.object({
  input: z.string(),
  slug: z.string(),
  relativePath: z.string(),
  absolutePath: z.string(),
});
const ValidationFindingSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.string().optional(),
});
const CommandResultSchema = z.object({
  status: z.number(),
  stdout: z.string(),
  stderr: z.string(),
});

type CliOptions = z.infer<typeof CliOptionsSchema>;
type ParsedArgs = z.infer<typeof ParsedArgsSchema>;
type InteractiveAnswers = z.infer<typeof InteractiveAnswersSchema>;
type SourceRepository = z.infer<typeof SourceRepositorySchema>;
type DocumentPath = z.infer<typeof DocumentPathSchema>;
type ValidationFinding = z.infer<typeof ValidationFindingSchema>;
type CommandResult = z.infer<typeof CommandResultSchema>;
type PromptQuestion = Parameters<typeof prompts>[0];
type PromptRunner = (questions: PromptQuestion) => Promise<unknown>;
type AutocompleteChoice = {
  title: string;
  value: string;
  description: string;
};
type ReviewGateEnvironment = {
  changedNames: () => string[];
  exists: (absolutePath: string) => boolean;
  readText: (absolutePath: string) => Promise<string>;
  validatePublicPaths: (docPath: string) => Result<string>;
};
type ReviewScopeRule = {
  pattern: string;
  matches: (file: string, docPath: string) => boolean;
};

type Result<T> =
  | {
      ok: true;
      value: T;
    }
  | {
      ok: false;
      message: string;
      details: Record<string, unknown>;
    };

const WORKSPACE_ROOT = process.cwd();
const SCAN_SCRIPT = ".cursor/skills/docs-site-add-visual-doc/scripts/scan-source.sh";
const PUBLIC_PATH_SCRIPT = ".cursor/skills/docs-site-add-visual-doc/scripts/validate-public-paths.sh";

const REVIEW_SCOPE_RULES: ReviewScopeRule[] = [
  {
    pattern: "{docPath}",
    matches: (file, docPath) => file === docPath,
  },
  {
    pattern: "index.html",
    matches: (file) => file === "index.html",
  },
  {
    pattern: "CONTEXT.md",
    matches: (file) => file === "CONTEXT.md",
  },
  {
    pattern: ".gitignore",
    matches: (file) => file === ".gitignore",
  },
  {
    pattern: "docs/adr/*.md",
    matches: (file) => /^docs\/adr\/[^/]+\.md$/u.test(file),
  },
  {
    pattern: "docs/design-docs/*.md",
    matches: (file) => /^docs\/design-docs\/[^/]+\.md$/u.test(file),
  },
  {
    pattern: "scripts/*.ts",
    matches: (file) => /^scripts\/[^/]+\.ts$/u.test(file),
  },
  {
    pattern: "package.json",
    matches: (file) => file === "package.json",
  },
  {
    pattern: "package-lock.json",
    matches: (file) => file === "package-lock.json",
  },
  {
    pattern: "tsconfig.json",
    matches: (file) => file === "tsconfig.json",
  },
  {
    pattern: "vitest.config.ts",
    matches: (file) => file === "vitest.config.ts",
  },
];

/** Wraps a successful operation in the shared CLI result shape. */
const ok = <T>(value: T): Result<T> => ({ ok: true, value });

/** Wraps a failed operation in the shared CLI result shape. */
const err = <T = never>(message: string, details: Record<string, unknown> = {}): Result<T> => ({
  ok: false,
  message,
  details,
});

/** Writes one stdout line. */
const print = (message: string): void => {
  process.stdout.write(`${message}\n`);
};

/** Writes one stderr line. */
const printError = (message: string): void => {
  process.stderr.write(`${message}\n`);
};

/** Runs prompts behind a small adapter so tests can inject answers. */
const runPrompts = async (questions: PromptQuestion): Promise<unknown> => prompts(questions);

/** Converts a prompt choice value to searchable text. */
const choiceValueText = (value: unknown): string => (typeof value === "string" ? value : "");

/** Returns choices matching the current autocomplete input. */
const suggestChoices = async (input: string, choices: prompts.Choice[]): Promise<prompts.Choice[]> => {
  const query = input.trim().toLowerCase();
  return query.length === 0
    ? choices
    : choices.filter(({ title, value, description }) =>
        [title, choiceValueText(value), description ?? ""].some((item) => item.toLowerCase().includes(query)),
      );
};

/** Builds the Commander program without binding it to process globals. */
const createProgram = (onCommand: (command: string, options: CliOptions) => void): Command => {
  const program = new Command();
  program
    .name("visual-doc-workflow")
    .description("Coordinate visual documentation prepare and validate modes.")
    .exitOverride()
    .allowExcessArguments(false);

  program
    .command("prepare")
    .description("Acquire a Source Repository and write a documentation runbook.")
    .option("--source <source>", "Existing source repository under repos/")
    .option("--url <url>", "Git URL to clone when the source repository is missing")
    .option("--name <name>", "Clone name override for URL-based acquisition")
    .option("--doc <doc>", "Documentation slug or docs/*.html path override")
    .action((options: unknown) => {
      onCommand("prepare", CliOptionsSchema.parse(options));
    });

  program
    .command("validate")
    .description("Run the review gate for a visual documentation page.")
    .option("--doc <doc>", "Documentation slug or docs/*.html path")
    .action((options: unknown) => {
      onCommand("validate", CliOptionsSchema.parse(options));
    });

  return program;
};

/** Parses CLI arguments into a command and flag map through Commander. */
const parseArgs = (argv: string[]): ParsedArgs => {
  const parsedCommands: ParsedArgs[] = [];
  const program = createProgram((command, options) => {
    parsedCommands.push({ command, options });
  });

  program.parse(["node", "visual-doc-workflow.ts", ...argv], { from: "node" });

  return ParsedArgsSchema.parse(parsedCommands.at(0) ?? { options: {} });
};

/** Removes empty prompt responses before turning them into CLI options. */
const compactCliOptions = (answers: InteractiveAnswers): CliOptions =>
  CliOptionsSchema.parse({
    doc: answers.doc || undefined,
    name: answers.name || undefined,
    source: answers.source || undefined,
    url: answers.url || undefined,
  });

/** Lists existing Visual Documentation Pages as autocomplete choices. */
const listDocumentChoices = async (): Promise<AutocompleteChoice[]> => {
  const docsDir = path.join(WORKSPACE_ROOT, "docs");
  const entries = await readdir(docsDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".html"))
    .map((entry) => {
      const slug = path.basename(entry.name, ".html");
      return {
        title: slug,
        value: slug,
        description: `docs/${entry.name}`,
      };
    })
    .sort((left, right) => left.title.localeCompare(right.title));
};

/** Lists existing Source Repositories as autocomplete choices. */
const listSourceChoices = async (): Promise<AutocompleteChoice[]> => {
  const reposDir = path.join(WORKSPACE_ROOT, "repos");
  if (!existsSync(reposDir)) {
    return [];
  }

  const entries = await readdir(reposDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      title: entry.name,
      value: entry.name,
      description: `repos/${entry.name}`,
    }))
    .sort((left, right) => left.title.localeCompare(right.title));
};

/** Prompts for a documentation target when validate mode lacks --doc. */
const collectValidateOptions = async (
  promptRunner: PromptRunner,
  existingOptions: CliOptions = {},
): Promise<CliOptions> => {
  if (existingOptions.doc) {
    return existingOptions;
  }

  const docAnswers = InteractiveAnswersSchema.parse(
    await promptRunner({
      type: "autocomplete",
      name: "doc",
      message: "Documentation slug or docs/*.html path",
      choices: await listDocumentChoices(),
      suggest: suggestChoices,
      validate: (value: string) => value.trim().length > 0 || "Documentation path is required.",
    }),
  );
  return compactCliOptions({ ...existingOptions, ...docAnswers });
};

/** Prompts for Source Repository inputs when prepare mode lacks --source or --url. */
const collectPrepareOptions = async (
  promptRunner: PromptRunner,
  existingOptions: CliOptions = {},
): Promise<CliOptions> => {
  if (existingOptions.source || existingOptions.url) {
    return existingOptions;
  }

  const sourceModeAnswers = InteractiveAnswersSchema.parse(
    await promptRunner({
      type: "select",
      name: "sourceMode",
      message: "Prepare from",
      choices: [
        { title: "Existing Source Repository under repos/", value: "source" },
        { title: "Git URL to clone if missing", value: "url" },
      ],
    }),
  );

  if (!sourceModeAnswers.sourceMode) {
    throw new Error("Interactive mode cancelled.");
  }

  const optionAnswers = InteractiveAnswersSchema.parse(
    await promptRunner(
      sourceModeAnswers.sourceMode === "source"
        ? [
            {
              type: "autocomplete",
              name: "source",
              message: "Source Repository path or name",
              choices: await listSourceChoices(),
              suggest: suggestChoices,
              validate: (value: string) => value.trim().length > 0 || "Source Repository is required.",
            },
            {
              type: existingOptions.doc ? null : "text",
              name: "doc",
              message: "Documentation slug override (optional)",
            },
          ]
        : [
            {
              type: "text",
              name: "url",
              message: "Git URL",
              validate: (value: string) => value.trim().length > 0 || "Git URL is required.",
            },
            {
              type: existingOptions.name ? null : "text",
              name: "name",
              message: "Clone name override (optional)",
            },
            {
              type: existingOptions.doc ? null : "text",
              name: "doc",
              message: "Documentation slug override (optional)",
            },
          ],
    ),
  );

  return compactCliOptions({ ...existingOptions, ...optionAnswers });
};

/** Collects CLI mode and options from prompts when no argv is provided. */
const collectInteractiveArgs = async (promptRunner: PromptRunner = runPrompts): Promise<ParsedArgs> => {
  const modeAnswers = InteractiveAnswersSchema.parse(
    await promptRunner({
      type: "select",
      name: "mode",
      message: "Workflow mode",
      choices: [
        { title: "Prepare - acquire source and write runbook", value: "prepare" },
        { title: "Validate - run review gate for a doc", value: "validate" },
      ],
    }),
  );

  if (!modeAnswers.mode) {
    throw new Error("Interactive mode cancelled.");
  }

  return modeAnswers.mode === "validate"
    ? ParsedArgsSchema.parse({ command: "validate", options: await collectValidateOptions(promptRunner) })
    : ParsedArgsSchema.parse({ command: "prepare", options: await collectPrepareOptions(promptRunner) });
};

/** Parses argv and prompts for missing required options in command-specific scripts. */
const collectCliArgs = async (argv: string[], promptRunner: PromptRunner = runPrompts): Promise<ParsedArgs> => {
  if (argv.length === 0) {
    return collectInteractiveArgs(promptRunner);
  }

  const parsed = parseArgs(argv);
  return parsed.command === "validate"
    ? ParsedArgsSchema.parse({
        command: "validate",
        options: await collectValidateOptions(promptRunner, parsed.options),
      })
    : parsed.command === "prepare"
      ? ParsedArgsSchema.parse({
          command: "prepare",
          options: await collectPrepareOptions(promptRunner, parsed.options),
        })
      : parsed;
};

/** Removes a trailing .git suffix from a repository-like name. */
const trimGitSuffix = (value: string): string => value.replace(/\.git$/u, "");

/** Extracts a clone directory candidate from HTTPS or SSH Git URLs. */
const basenameFromUrl = (url: string): string => {
  const pathname = (() => {
    try {
      return new URL(url).pathname;
    } catch {
      return url.split(":").at(-1) ?? url;
    }
  })();
  return trimGitSuffix(path.basename(pathname));
};

/** Converts a free-form name into a docs-site slug. */
const slugify = (value: string): string => {
  const normalized = value
    .replace(/([a-z0-9])([A-Z])/gu, "$1-$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
  return normalized || "visual-doc";
};

/** Produces a slug with at most four hyphen-separated words unless an override is provided. */
const boundedSlug = (value: string, override?: string): string => {
  const slug = slugify(override || value);
  const parts = slug.split("-").filter(Boolean);
  return parts.length <= 4 ? slug : parts.slice(0, 4).join("-");
};

/** Resolves supported doc inputs to one canonical docs/*.html path. */
const normalizeDocPath = (input: string): DocumentPath => {
  const normalizedInput = input.replace(/\\/gu, "/").replace(/^\.?\//u, "");
  const withoutDocs = normalizedInput.startsWith("docs/")
    ? normalizedInput.slice("docs/".length)
    : normalizedInput;
  const parts = withoutDocs.split("/").filter(Boolean);
  if (parts.length !== 1 || parts.includes("..") || path.isAbsolute(withoutDocs)) {
    throw new Error(`Documentation path must resolve to a file directly under docs/: ${input}`);
  }

  const withExtension = withoutDocs.endsWith(".html") ? withoutDocs : `${withoutDocs}.html`;
  const docPath = path.join("docs", withExtension);
  return DocumentPathSchema.parse({
    input,
    slug: path.basename(withExtension, ".html"),
    relativePath: docPath,
    absolutePath: path.join(WORKSPACE_ROOT, docPath),
  });
};

/** Converts an absolute workspace path to a portable repository-relative path. */
const relativeFromRoot = (absolutePath: string): string =>
  path.relative(WORKSPACE_ROOT, absolutePath).replace(/\\/gu, "/");

/** Resolves source input into a Source Repository under repos/. */
const resolveSourcePath = ({ source, url, name }: CliOptions): SourceRepository => {
  const sourceOption = typeof source === "string" ? source : undefined;
  const urlOption = typeof url === "string" ? url : undefined;
  const nameOption = typeof name === "string" ? name : undefined;
  const cloneName = nameOption ? slugify(nameOption) : urlOption ? slugify(basenameFromUrl(urlOption)) : null;
  const sourceValue = sourceOption || cloneName;
  if (!sourceValue) {
    throw new Error("prepare requires --source or --url.");
  }

  const sourcePath = path.isAbsolute(sourceValue)
    ? sourceValue
    : sourceValue.startsWith("repos/")
      ? path.join(WORKSPACE_ROOT, sourceValue)
      : path.join(WORKSPACE_ROOT, "repos", sourceValue);

  const relativePath = relativeFromRoot(sourcePath);
  if (!relativePath.startsWith("repos/")) {
    throw new Error(`Source Repository must resolve under repos/: ${relativePath}`);
  }

  return SourceRepositorySchema.parse({
    absolutePath: sourcePath,
    relativePath,
    cloneName: path.basename(sourcePath),
  });
};

/** Runs a child process from the workspace root and captures text output. */
const runCommand = (command: string, args: string[], options: { cwd?: string } = {}): CommandResult => {
  const result = spawnSync(command, args, {
    cwd: WORKSPACE_ROOT,
    encoding: "utf8",
    ...options,
  });
  return CommandResultSchema.parse({
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  });
};

/** Resolves a repository-owned workflow support script before delegating to bash. */
const resolveWorkflowScriptPath = (relativePath: string): Result<string> => {
  const absolutePath = path.join(WORKSPACE_ROOT, relativePath);
  return existsSync(absolutePath)
    ? ok(relativePath)
    : err("Workflow support script not found.", {
        script: relativePath,
      });
};

/** Checks that an existing Source Repository can be safely fast-forwarded. */
const assertCleanGitRepository = (source: SourceRepository): Result<SourceRepository> => {
  const gitDir = path.join(source.absolutePath, ".git");
  if (!existsSync(gitDir)) {
    return err("Blocked Source Repository: source is not a git repository.", { source: source.relativePath });
  }

  const status = runCommand("git", ["-C", source.absolutePath, "status", "--porcelain"]);
  if (status.status !== 0) {
    return err("Blocked Source Repository: failed to read source git status.", {
      source: source.relativePath,
      stderr: status.stderr,
    });
  }

  if (status.stdout.trim().length > 0) {
    return err("Blocked Source Repository: source has local changes.", {
      source: source.relativePath,
      status: status.stdout.trim(),
    });
  }

  return ok(source);
};

/** Clones a new Source Repository or fast-forwards an existing clean one. */
const acquireSource = (options: CliOptions): Result<SourceRepository> => {
  const resolved = resolveSourcePath(options);
  const urlOption = typeof options.url === "string" ? options.url : undefined;
  if (!existsSync(resolved.absolutePath)) {
    if (!urlOption) {
      return err("Source Repository not found. Use --url to clone a missing source.", {
        source: resolved.relativePath,
      });
    }

    const parent = path.dirname(resolved.absolutePath);
    const parentResult = runCommand("mkdir", ["-p", parent]);
    if (parentResult.status !== 0) {
      return err("Failed to create repos directory.", { stderr: parentResult.stderr });
    }

    const clone = runCommand("git", ["clone", urlOption, resolved.absolutePath]);
    return clone.status === 0
      ? ok(SourceRepositorySchema.parse({ ...resolved, acquiredBy: "clone" }))
      : err("Failed to clone Source Repository.", { source: resolved.relativePath, stderr: clone.stderr });
  }

  const clean = assertCleanGitRepository(resolved);
  if (!clean.ok) {
    return clean;
  }

  const pull = runCommand("git", ["-C", resolved.absolutePath, "pull", "--ff-only"]);
  return pull.status === 0
    ? ok(SourceRepositorySchema.parse({ ...resolved, acquiredBy: "fast-forward", pullOutput: pull.stdout.trim() }))
    : err("Blocked Source Repository: fast-forward pull failed.", {
        source: resolved.relativePath,
        stderr: pull.stderr || pull.stdout,
      });
};

/** Runs the existing source inventory script and returns its text summary. */
const runSourceInventory = (source: SourceRepository): Result<string> => {
  const script = resolveWorkflowScriptPath(SCAN_SCRIPT);
  if (!script.ok) {
    return script;
  }

  const scan = runCommand("bash", [script.value, source.relativePath]);
  return scan.status === 0
    ? ok(scan.stdout.trim())
    : err("Failed to scan Source Repository.", { source: source.relativePath, stderr: scan.stderr });
};

/** Reads git status with untracked files expanded to file-level entries. */
const gitStatusShort = (): string => runCommand("git", ["status", "--short", "--untracked-files=all"]).stdout.trim();

/** Extracts a file path from one git status --short line. */
const pathFromStatusLine = (line: string): string => {
  const rawPath = line.match(/^.. ?(.+)$/u)?.[1] ?? line.trim();
  return rawPath.includes(" -> ") ? (rawPath.split(" -> ").at(-1) ?? rawPath) : rawPath;
};

/** Returns all changed and untracked file names reported by git status. */
const gitChangedNames = (): string[] => [
  ...new Set(
    gitStatusShort()
      .split(/\r?\n/u)
      .map((line) => line.trimEnd())
      .filter(Boolean)
      .map(pathFromStatusLine),
  ),
];

/** Lists the human-readable Review Scope patterns for a documentation target. */
const allowedReviewScope = (docPath: string): string[] =>
  REVIEW_SCOPE_RULES.map((rule) => (rule.pattern === "{docPath}" ? docPath : rule.pattern));

/** Checks whether a changed file belongs to the Review Scope. */
const matchesScope = (file: string, docPath: string): boolean =>
  REVIEW_SCOPE_RULES.some((rule) => rule.matches(file, docPath));

/** Determines whether a Visual Documentation Page is new or an update. */
const pageStatus = (docPath: string): "new" | "update" =>
  existsSync(path.join(WORKSPACE_ROOT, docPath)) ? "update" : "new";

/** Builds the Markdown runbook consumed by the authoring agent. */
const buildRunbook = ({
  source,
  doc,
  inventory,
}: {
  source: SourceRepository;
  doc: Pick<DocumentPath, "relativePath" | "slug">;
  inventory: string;
}): string => {
  const branchName = `docs/${doc.slug}`;
  const status = pageStatus(doc.relativePath);
  const scope = allowedReviewScope(doc.relativePath).map((item) => `- \`${item}\``).join("\n");
  return `# ${doc.slug} Visual Documentation Runbook

## Summary

- Source Repository: \`${source.relativePath}\`
- Source Acquisition: ${source.acquiredBy ?? "unknown"}
- Visual Documentation Page: \`${doc.relativePath}\`
- Page Status: ${status}
- Branch Name Suggestion: \`${branchName}\`
- Runbook Name: \`${doc.slug}-runbook.md\`

## Source Inventory

\`\`\`text
${inventory}
\`\`\`

## Authoring Handoff

Use \`docs-site-add-visual-doc\` to perform Documentation Authoring for this Source Repository.

- Read \`index.html\`, \`docs/defuddle.html\`, and \`.cursor/skills/docs-site-add-visual-doc/references/visual-explainer-core.md\` before authoring.
- Treat \`${source.relativePath}\` as the source root.
- Write or update \`${doc.relativePath}\`.
- Update \`index.html\` with the matching doc-list card.
- Keep public copy free of local absolute paths and source workspace paths.
- Do not stage Source Repository files.

## Review Gate

- \`${doc.relativePath}\` exists.
- \`index.html\` links to \`${doc.relativePath}\`.
- HTML head includes \`og:title\`, \`og:url\`, \`og:description\`, and \`twitter:card\`.
- Public path validation passes.
- Git status does not include Source Repository files.
- Diff stays within Review Scope.

## Review Scope

${scope}

## Next Commands

\`\`\`bash
npx tsx scripts/visual-doc-workflow.ts validate --doc ${doc.slug}
\`\`\`
`;
};

/** Writes a runbook to the unversioned runbook location. */
const writeRunbook = async ({ doc, content }: { doc: Pick<DocumentPath, "slug">; content: string }): Promise<string> => {
  const runbookDir = path.join(WORKSPACE_ROOT, "tmp");
  const runbookPath = path.join(runbookDir, `${doc.slug}-runbook.md`);
  await mkdir(runbookDir, { recursive: true });
  await writeFile(runbookPath, content, "utf8");
  return relativeFromRoot(runbookPath);
};

/** Executes Prepare Mode: acquire source, scan it, and write the runbook. */
const prepare = async (options: CliOptions): Promise<Result<Record<string, string>>> => {
  const acquired = acquireSource(options);
  if (!acquired.ok) {
    return acquired;
  }

  const docOverride = typeof options.doc === "string" ? options.doc : undefined;
  const docSlug = boundedSlug(docOverride || acquired.value.cloneName);
  const doc = normalizeDocPath(docSlug);
  const inventory = runSourceInventory(acquired.value);
  if (!inventory.ok) {
    return inventory;
  }

  const runbook = buildRunbook({ source: acquired.value, doc, inventory: inventory.value });
  const runbookPath = await writeRunbook({ doc, content: runbook });
  return ok({
    source: acquired.value.relativePath,
    doc: doc.relativePath,
    pageStatus: pageStatus(doc.relativePath),
    runbook: runbookPath,
  });
};

/** Extracts raw head content from an HTML string. */
const headContent = (html: string): string => html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/iu)?.[1] ?? "";

/** Checks whether a required Open Graph or Twitter card meta tag exists inside head. */
const hasHeadMeta = (html: string, marker: string): boolean => {
  const head = headContent(html);
  return marker === "twitter:card"
    ? /<meta\s+[^>]*name=["']twitter:card["'][^>]*>/iu.test(head)
    : new RegExp(`<meta\\s+[^>]*property=["']${marker}["'][^>]*>`, "iu").test(head);
};

/** Delegates public path safety checks to the existing docs-site validation script. */
const validatePublicPaths = (docPath: string): Result<string> => {
  const script = resolveWorkflowScriptPath(PUBLIC_PATH_SCRIPT);
  if (!script.ok) {
    return script;
  }

  const result = runCommand("bash", [script.value, docPath]);
  return result.status === 0 ? ok(result.stdout.trim()) : err("Public path validation failed.", { stderr: result.stderr });
};

/** Extracts the most actionable text from a failed Result details object. */
const failureDetailsText = (details: Record<string, unknown>): string | undefined => {
  const stderr = details.stderr;
  if (typeof stderr === "string") {
    return stderr.trim();
  }

  const script = details.script;
  return typeof script === "string" ? script : undefined;
};

/** Maps public path checker failures to review gate findings without hiding infrastructure errors. */
const publicPathFinding = (result: Extract<Result<string>, { ok: false }>): ValidationFinding =>
  ValidationFindingSchema.parse({
    code: result.details.script ? "public-path-check-failed" : "public-path-leak",
    message: result.message,
    details: failureDetailsText(result.details),
  });

/** Creates the default Review Gate environment from the local workspace. */
const createReviewGateEnvironment = (): ReviewGateEnvironment => ({
  changedNames: gitChangedNames,
  exists: existsSync,
  readText: async (absolutePath) => readFile(absolutePath, "utf8"),
  validatePublicPaths,
});

/** Evaluates the Review Gate and returns all actionable Validation Findings. */
const evaluateReviewGate = async (
  doc: DocumentPath,
  environment: ReviewGateEnvironment = createReviewGateEnvironment(),
): Promise<ValidationFinding[]> => {
  const findings: ValidationFinding[] = [];

  if (!environment.exists(doc.absolutePath)) {
    findings.push(
      ValidationFindingSchema.parse({
        code: "missing-doc",
        message: `Visual Documentation Page not found: ${doc.relativePath}`,
      }),
    );
  }

  const indexHtml = await environment.readText(path.join(WORKSPACE_ROOT, "index.html"));
  if (!indexHtml.includes(doc.relativePath)) {
    findings.push(
      ValidationFindingSchema.parse({
        code: "missing-index-link",
        message: `index.html does not link to ${doc.relativePath}`,
      }),
    );
  }

  const html = environment.exists(doc.absolutePath) ? await environment.readText(doc.absolutePath) : "";
  const missingMeta = ["og:title", "og:url", "og:description", "twitter:card"].filter(
    (marker) => !hasHeadMeta(html, marker),
  );
  if (missingMeta.length > 0) {
    findings.push(
      ValidationFindingSchema.parse({
        code: "missing-head-meta",
        message: `HTML head is missing: ${missingMeta.join(", ")}`,
      }),
    );
  }

  if (environment.exists(doc.absolutePath)) {
    const publicPaths = environment.validatePublicPaths(doc.relativePath);
    if (!publicPaths.ok) {
      findings.push(publicPathFinding(publicPaths));
    }
  }

  const changedNames = environment.changedNames();
  const sourceStatus = changedNames.filter((file) => file.startsWith("repos/"));
  if (sourceStatus.length > 0) {
    findings.push(
      ValidationFindingSchema.parse({
        code: "source-in-git-status",
        message: "Source Repository files appear in git status.",
        details: sourceStatus.join("\n"),
      }),
    );
  }

  const outOfScope = changedNames.filter((file) => !matchesScope(file, doc.relativePath));
  if (outOfScope.length > 0) {
    findings.push(
      ValidationFindingSchema.parse({
        code: "out-of-scope-diff",
        message: "Git diff contains files outside Review Scope.",
        details: outOfScope.join("\n"),
      }),
    );
  }

  return findings;
};

/** Executes Validate Mode and returns Review Gate findings without modifying files. */
const validate = async (options: CliOptions): Promise<Result<{ doc: string }>> => {
  if (!options.doc) {
    return err("validate requires --doc.");
  }

  const doc = normalizeDocPath(options.doc);
  const findings = await evaluateReviewGate(doc);

  return findings.length === 0 ? ok({ doc: doc.relativePath }) : err("Review Gate failed.", { findings });
};

/** Formats a CLI result as JSON for stable human and agent consumption. */
const formatResult = <T>(result: Result<T>): string => {
  if (result.ok) {
    return JSON.stringify({ ok: true, ...result.value }, null, 2);
  }
  return JSON.stringify({ ok: false, message: result.message, ...result.details }, null, 2);
};

/** Dispatches the requested CLI mode. */
const main = async (argv: string[]): Promise<number> => {
  const result = await (async (): Promise<Result<Record<string, unknown>>> => {
    try {
      const { command, options } = await collectCliArgs(argv);
      return command === "prepare"
        ? await prepare(options)
        : command === "validate"
          ? await validate(options)
          : err("Unknown command. Use prepare or validate.");
    } catch (error) {
      return err(error instanceof Error ? error.message : String(error));
    }
  })();

  if (result.ok) {
    print(formatResult(result));
    return 0;
  }

  printError(formatResult(result));
  return 1;
};

const isDirectRun = process.argv[1] ? path.basename(process.argv[1]) === "visual-doc-workflow.ts" : false;
if (isDirectRun) {
  main(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}

export {
  basenameFromUrl,
  boundedSlug,
  buildRunbook,
  collectCliArgs,
  collectInteractiveArgs,
  evaluateReviewGate,
  gitChangedNames,
  hasHeadMeta,
  listDocumentChoices,
  listSourceChoices,
  matchesScope,
  normalizeDocPath,
  parseArgs,
  pathFromStatusLine,
  prepare,
  resolveSourcePath,
  slugify,
  validate,
};

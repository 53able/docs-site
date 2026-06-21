#!/usr/bin/env -S npx tsx
/**
 * docs-site 向けビジュアルドキュメント用ワークフロー CLI。
 * ソースリポジトリの取得、著者向けランブックの出力、`docs/*.html` のレビューゲート検証（スコープ・メタタグ・公開パス）を行う。
 *
 * @remarks
 * **English:** Acquire source repos, emit authoring runbooks, and validate visual doc pages against the review gate (scope, meta tags, public paths).
 *
 * **サブコマンド概要**
 * - `prepare`: `repos/*` をクローンまたは origin デフォルトブランチへ強制同期、インベントリスキャン、`tmp/<slug>-runbook.md` を出力。
 * - `validate`: `docs/*.html`、`index.html` へのリンク、`<head>` メタ、公開パス用 bash、git 変更スコープを検証。
 *
 * @example npm scripts
 * ```bash
 * npm run docs:prepare -- --source my-repo [--doc my-slug]
 * npm run docs:prepare -- --url https://github.com/org/repo.git [--name clone-name] [--doc slug]
 * npm run docs:validate -- --doc slug
 * ```
 *
 * @example direct tsx
 * ```bash
 * npx tsx scripts/visual-doc-workflow.ts prepare --source my-repo [--doc slug]
 * npx tsx scripts/visual-doc-workflow.ts prepare --url https://github.com/org/repo.git [--name name] [--doc slug]
 * npx tsx scripts/visual-doc-workflow.ts validate --doc slug
 * ```
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Command } from "commander";
import prompts = require("prompts");
import { z } from "zod";

/** 対話モードで選択するワークフロー種別（ランブック準備かレビューゲート検証か）。 */
const InteractiveModeSchema = z.enum(["prepare", "validate"]);

/** `prepare` の対話フローで、既存の `repos/` を選ぶか Git URL を選ぶか。 */
const InteractiveSourceModeSchema = z.enum(["source", "url"]);

/** Commander がパースしたフラグ（`prepare` / `validate` 共通）。 */
const CliOptionsSchema = z
  .object({
    doc: z.string().optional(),
    name: z.string().optional(),
    source: z.string().optional(),
    url: z.string().optional(),
  })
  .strict();

/** パース結果：サブコマンド名（任意）と検証済み CLI オプション。 */
const ParsedArgsSchema = z.object({
  command: z.string().optional(),
  options: CliOptionsSchema,
});

/** `prompts` の応答。空文字はトリム後に {@link CliOptions} にマージされる。 */
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

/** クローンまたは解決後の `repos/` 配下パスと、取得方法などのメタデータ（任意）。 */
const SourceRepositorySchema = z.object({
  absolutePath: z.string(),
  relativePath: z.string(),
  cloneName: z.string(),
  acquiredBy: z.enum(["clone", "origin-sync"]).optional(),
  syncBranch: z.string().optional(),
});

/** `docs/` 直下のビジュアルドキュメント HTML の正規表現。 */
const DocumentPathSchema = z.object({
  input: z.string(),
  slug: z.string(),
  relativePath: z.string(),
  absolutePath: z.string(),
});

/** レビューゲート失敗時に報告する単一の問題。 */
const ValidationFindingSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.string().optional(),
});

/** {@link runCommand} の終了コードと標準出力・標準エラー。 */
const CommandResultSchema = z.object({
  status: z.number(),
  stdout: z.string(),
  stderr: z.string(),
});

/** Zod パース後のフラグ: `--doc`, `--name`, `--source`, `--url`。 */
type CliOptions = z.infer<typeof CliOptionsSchema>;

/** {@link parseArgs} または対話入力で得た、一致したサブコマンドとそのオプション。 */
type ParsedArgs = z.infer<typeof ParsedArgsSchema>;

/** `prompts` の生の回答。{@link compactCliOptions} 前の型。 */
type InteractiveAnswers = z.infer<typeof InteractiveAnswersSchema>;

/** インベントリ・ランブック生成の参照元となる `repos/<name>` ツリー。 */
type SourceRepository = z.infer<typeof SourceRepositorySchema>;

/** 検証・ランブック生成の対象となる `docs/*.html` パス。 */
type DocumentPath = z.infer<typeof DocumentPathSchema>;

/** 検証失敗 1 件。詳細（例: stderr 抜粋）は任意。 */
type ValidationFinding = z.infer<typeof ValidationFindingSchema>;

/** `spawnSync` ラッパー {@link runCommand} の構造化出力。 */
type CommandResult = z.infer<typeof CommandResultSchema>;

/** `prompts` ライブラリが受け取る質問オブジェクトの型。 */
type PromptQuestion = Parameters<typeof prompts>[0];

/** テスト用に差し替え可能なプロンプト実行関数。 */
type PromptRunner = (questions: PromptQuestion) => Promise<unknown>;

/** オートコンプリート用: ドキュメントや `repos` の選択肢 1 行。 */
type AutocompleteChoice = {
  title: string;
  value: string;
  description: string;
};

/**
 * {@link evaluateReviewGate} 向けの依存注入面（ファイルシステム・git・公開パス検証）。
 */
type ReviewGateEnvironment = {
  changedNames: () => string[];
  exists: (absolutePath: string) => boolean;
  readText: (absolutePath: string) => Promise<string>;
  validatePublicPaths: (docPath: string) => Result<string>;
};

/** レビュースコープ: 表示用パターン文字列と、変更ファイルが許容かどうかの判定。 */
type ReviewScopeRule = {
  pattern: string;
  matches: (file: string, docPath: string) => boolean;
};

/**
 * ワークフロー結果の判別共用型。成功時は値、失敗時はメッセージと詳細オブジェクト。
 *
 * @typeParam T - `ok: true` 分枝で運ぶ値の型。
 */
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

/** カレントワーキングディレクトリ。相対パスはここを基準に解決する。 */
const WORKSPACE_ROOT = process.cwd();

/** `docs-site-add-visual-doc` スキル由来のソースインベントリ用 bash。 */
const SCAN_SCRIPT = ".cursor/skills/docs-site-add-visual-doc/scripts/scan-source.sh";

/** 公開 HTML にローカル／ワークスペースパスが漏れていないか検査する bash。 */
const PUBLIC_PATH_SCRIPT = ".cursor/skills/docs-site-add-visual-doc/scripts/validate-public-paths.sh";

/**
 * ビジュアルドキュメント PR で変更してよいファイルの許容パターン（`{docPath}` は対象 HTML に置換）。
 *
 * @remarks {@link matchesScope} が `validate` 時の git 変更のスコープ外を検出するために使用する。
 */
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
    pattern: "docs/pi-mono.html (removed when validating docs/pi.html)",
    matches: (file, docPath) => file === "docs/pi-mono.html" && docPath === "docs/pi.html",
  },
  {
    pattern: "docs/llmfit.html (removed when superseded by docs/alexs-jones-llmfit.html)",
    matches: (file, docPath) => file === "docs/llmfit.html" && docPath === "docs/alexs-jones-llmfit.html",
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

/** 成功結果を共通の {@link Result} 形でラップする。 */
const ok = <T>(value: T): Result<T> => ({ ok: true, value });

/** 失敗結果を共通の {@link Result} 形でラップする。 */
const err = <T = never>(message: string, details: Record<string, unknown> = {}): Result<T> => ({
  ok: false,
  message,
  details,
});

/** 標準出力に 1 行書き込む。 */
const print = (message: string): void => {
  process.stdout.write(`${message}\n`);
};

/** 標準エラーに 1 行書き込む。 */
const printError = (message: string): void => {
  process.stderr.write(`${message}\n`);
};

/** テストで差し替え可能な薄いアダプタで `prompts` を実行する。 */
const runPrompts = async (questions: PromptQuestion): Promise<unknown> => prompts(questions);

/** オートコンプリートの選択肢の `value` を検索用文字列に変換する。 */
const choiceValueText = (value: unknown): string => (typeof value === "string" ? value : "");

/** 現在の入力に一致するオートコンプリート候補だけを返す。 */
const suggestChoices = async (input: string, choices: prompts.Choice[]): Promise<prompts.Choice[]> => {
  const query = input.trim().toLowerCase();
  return query.length === 0
    ? choices
    : choices.filter(({ title, value, description }) =>
        [title, choiceValueText(value), description ?? ""].some((item) => item.toLowerCase().includes(query)),
      );
};

/**
 * Commander のプログラムを組み立てる。`process` にバインドせず、`onCommand` でディスパッチする。
 *
 * @param onCommand - サブコマンド名と検証済みオプションを受け取るコールバック。
 * @returns 設定済みの `Command` インスタンス。
 */
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

/**
 * argv を Commander でパースし、コマンド名とフラグマップを返す。
 *
 * @param argv - `process.argv` 相当（スクリプト名は含めない想定で結合側が付与）。
 */
const parseArgs = (argv: string[]): ParsedArgs => {
  const parsedCommands: ParsedArgs[] = [];
  const program = createProgram((command, options) => {
    parsedCommands.push({ command, options });
  });

  program.parse(["node", "visual-doc-workflow.ts", ...argv], { from: "node" });

  return ParsedArgsSchema.parse(parsedCommands.at(0) ?? { options: {} });
};

/** 空のプロンプト回答を落としてから {@link CliOptions} に正規化する。 */
const compactCliOptions = (answers: InteractiveAnswers): CliOptions =>
  CliOptionsSchema.parse({
    doc: answers.doc || undefined,
    name: answers.name || undefined,
    source: answers.source || undefined,
    url: answers.url || undefined,
  });

/** `docs/*.html` を列挙し、オートコンプリート用の選択肢を作る。 */
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

/** `repos/` 直下のディレクトリを列挙し、オートコンプリート用の選択肢を作る。 */
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

/**
 * `validate` で `--doc` が無いとき、対話でドキュメントを選ぶ。
 *
 * @param promptRunner - プロンプト実行（テストでモック可能）。
 * @param existingOptions - 既に渡っている CLI オプション。
 */
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

/**
 * `prepare` で `--source` も `--url` も無いとき、対話で取得元を選ぶ。
 *
 * @param promptRunner - プロンプト実行（テストでモック可能）。
 * @param existingOptions - 既に渡っている CLI オプション。
 */
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

/**
 * argv が空のとき、モードと不足オプションを対話で集める。
 *
 * @param promptRunner - 既定は {@link runPrompts}。
 */
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

  if (modeAnswers.mode === "validate") {
    return ParsedArgsSchema.parse({
      command: "validate",
      options: await collectValidateOptions(promptRunner),
    });
  }

  return ParsedArgsSchema.parse({
    command: "prepare",
    options: await collectPrepareOptions(promptRunner),
  });
};

/**
 * argv をパースし、サブコマンドごとに不足している必須オプションを対話で補う。
 *
 * @param argv - `main` から渡す引数列（通常は `process.argv.slice(2)`）。
 * @param promptRunner - 既定は {@link runPrompts}。
 */
const collectCliArgs = async (argv: string[], promptRunner: PromptRunner = runPrompts): Promise<ParsedArgs> => {
  if (argv.length === 0) {
    return collectInteractiveArgs(promptRunner);
  }

  const parsed = parseArgs(argv);
  if (parsed.command === "validate") {
    return ParsedArgsSchema.parse({
      command: "validate",
      options: await collectValidateOptions(promptRunner, parsed.options),
    });
  }

  if (parsed.command === "prepare") {
    return ParsedArgsSchema.parse({
      command: "prepare",
      options: await collectPrepareOptions(promptRunner, parsed.options),
    });
  }

  return parsed;
};

/** リポジトリ名っぽい文字列末尾の `.git` を除去する。 */
const trimGitSuffix = (value: string): string => value.replace(/\.git$/u, "");

/**
 * HTTPS / SSH の Git URL から、クローン先ディレクトリ名の候補（ベース名）を推定する。
 *
 * @param url - クローン元 URL。
 */
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

/**
 * 任意の文字列を URL・ファイル名向けのスラッグへ正規化する。
 *
 * @param value - リポジトリ名やタイトルなど。
 */
const slugify = (value: string): string => {
  const normalized = value
    .replace(/([a-z0-9])([A-Z])/gu, "$1-$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
  return normalized || "visual-doc";
};

/**
 * ハイフン区切りは最大 4 語までに切り詰めたスラッグを返す（上書き指定があればそれを優先）。
 *
 * @param value - ベースとなる文字列（例: クローン名）。
 * @param override - ユーザー指定のドキュメントスラッグ。
 */
const boundedSlug = (value: string, override?: string): string => {
  const slug = slugify(override || value);
  const parts = slug.split("-").filter(Boolean);
  return parts.length <= 4 ? slug : parts.slice(0, 4).join("-");
};

/**
 * ユーザー入力（スラッグまたは `docs/foo.html` 形式）を `docs/` 直下の 1 ファイルへ正規化する。
 *
 * @param input - スラッグ、`docs/*.html`、相対パスなど。
 * @throws  `docs/` の直下ファイルに解決できない場合。
 */
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

/**
 * ワークスペースルートからの相対パス（POSIX 風の `/`）に変換する。
 *
 * @param absolutePath - 絶対パス。
 */
const relativeFromRoot = (absolutePath: string): string =>
  path.relative(WORKSPACE_ROOT, absolutePath).replace(/\\/gu, "/");

/**
 * `--source` / `--url` / `--name` から `repos/` 配下の {@link SourceRepository} を解決する。
 *
 * @throws `prepare` に必要な情報が無い、または `repos/` 外に解決した場合。
 */
const resolveSourcePath = ({ source, url, name }: CliOptions): SourceRepository => {
  const sourceOption = typeof source === "string" ? source : undefined;
  const urlOption = typeof url === "string" ? url : undefined;
  const nameOption = typeof name === "string" ? name : undefined;
  const cloneNameFromName = nameOption ? slugify(nameOption) : null;
  const cloneNameFromUrl = urlOption ? slugify(basenameFromUrl(urlOption)) : null;
  const cloneName = cloneNameFromName ?? cloneNameFromUrl;
  const sourceValue = sourceOption || cloneName;
  if (!sourceValue) {
    throw new Error("prepare requires --source or --url.");
  }

  const relativeSourcePath = sourceValue.startsWith("repos/")
    ? path.join(WORKSPACE_ROOT, sourceValue)
    : path.join(WORKSPACE_ROOT, "repos", sourceValue);
  const sourcePath = path.isAbsolute(sourceValue) ? sourceValue : relativeSourcePath;

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

/**
 * ワークスペースルートを cwd に子プロセスを実行し、標準出力・標準エラー・終了コードを取得する。
 *
 * @param command - 実行ファイル名。
 * @param args - 引数列。
 * @param options - `cwd` を上書きする場合に指定。
 */
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

/**
 * リポジトリ同梱のワークフロー補助スクリプトが存在するか確認し、相対パスを返す。
 *
 * @param relativePath - ワークスペースルートからの相対パス。
 */
const resolveWorkflowScriptPath = (relativePath: string): Result<string> => {
  const absolutePath = path.join(WORKSPACE_ROOT, relativePath);
  return existsSync(absolutePath)
    ? ok(relativePath)
    : err("Workflow support script not found.", {
        script: relativePath,
      });
};

/** `origin/HEAD` の short ref からブランチ名を取り出す（例: `origin/main` → `main`）。 */
const branchFromOriginHeadRef = (ref: string): string => ref.replace(/^origin\//u, "").trim();

/** `origin/HEAD` が解決できないときのフォールバックブランチ名。 */
const ORIGIN_FALLBACK_BRANCH = "main";

/**
 * 既存ソースが git リポジトリとして利用可能か検証する。
 *
 * @param source - 検査対象の {@link SourceRepository}。
 */
const assertGitRepository = (source: SourceRepository): Result<SourceRepository> => {
  const gitDir = path.join(source.absolutePath, ".git");
  if (!existsSync(gitDir)) {
    return err("Blocked Source Repository: source is not a git repository.", { source: source.relativePath });
  }

  return ok(source);
};

/**
 * `origin/HEAD` からデフォルトブランチ名を解決する。失敗時は `origin/main` を試す。
 *
 * @param absolutePath - ソースリポジトリの絶対パス。
 */
const resolveOriginDefaultBranch = (absolutePath: string): Result<string> => {
  const symbolic = runCommand("git", ["-C", absolutePath, "symbolic-ref", "--short", "refs/remotes/origin/HEAD"]);
  if (symbolic.status === 0) {
    const branch = branchFromOriginHeadRef(symbolic.stdout.trim());
    if (branch.length > 0) {
      return ok(branch);
    }
  }

  const fallback = runCommand("git", [
    "-C",
    absolutePath,
    "rev-parse",
    "--verify",
    `origin/${ORIGIN_FALLBACK_BRANCH}`,
  ]);
  return fallback.status === 0
    ? ok(ORIGIN_FALLBACK_BRANCH)
    : err("Failed to resolve origin default branch.", {
        stderr: symbolic.stderr || fallback.stderr,
      });
};

/**
 * 既存 clone を `origin` のデフォルトブランチ最新へ強制同期する。
 *
 * @param source - 同期対象の {@link SourceRepository}。
 */
const syncSourceToOriginDefault = (source: SourceRepository): Result<SourceRepository> => {
  const gitRepository = assertGitRepository(source);
  if (!gitRepository.ok) {
    return gitRepository;
  }

  const originUrl = runCommand("git", ["-C", source.absolutePath, "remote", "get-url", "origin"]);
  if (originUrl.status !== 0) {
    return err("Blocked Source Repository: source has no origin remote.", {
      source: source.relativePath,
      stderr: originUrl.stderr,
    });
  }

  const fetch = runCommand("git", ["-C", source.absolutePath, "fetch", "origin"]);
  if (fetch.status !== 0) {
    return err("Failed to fetch Source Repository.", {
      source: source.relativePath,
      stderr: fetch.stderr || fetch.stdout,
    });
  }

  const branchResult = resolveOriginDefaultBranch(source.absolutePath);
  if (!branchResult.ok) {
    return branchResult;
  }

  const branch = branchResult.value;
  const remoteBranch = `origin/${branch}`;

  const checkout = runCommand("git", ["-C", source.absolutePath, "checkout", "-B", branch, remoteBranch]);
  if (checkout.status !== 0) {
    return err("Failed to sync Source Repository.", {
      source: source.relativePath,
      phase: "checkout",
      stderr: checkout.stderr || checkout.stdout,
    });
  }

  const reset = runCommand("git", ["-C", source.absolutePath, "reset", "--hard", remoteBranch]);
  if (reset.status !== 0) {
    return err("Failed to sync Source Repository.", {
      source: source.relativePath,
      phase: "reset",
      stderr: reset.stderr || reset.stdout,
    });
  }

  const clean = runCommand("git", ["-C", source.absolutePath, "clean", "-fd"]);
  return clean.status === 0
    ? ok(
        SourceRepositorySchema.parse({
          ...source,
          acquiredBy: "origin-sync",
          syncBranch: branch,
        }),
      )
    : err("Failed to sync Source Repository.", {
        source: source.relativePath,
        phase: "clean",
        stderr: clean.stderr || clean.stdout,
      });
};

/**
 * ソースが無ければ `--url` でクローンし、あれば `origin/HEAD` の最新へ強制同期する。
 *
 * @param options - CLI オプション（`--source`, `--url`, `--name` など）。
 */
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
    if (clone.status !== 0) {
      return err("Failed to clone Source Repository.", { source: resolved.relativePath, stderr: clone.stderr });
    }
    return ok(SourceRepositorySchema.parse({ ...resolved, acquiredBy: "clone" }));
  }

  return syncSourceToOriginDefault(resolved);
};

/**
 * `scan-source.sh` を実行し、ソースツリーのインベントリ要約テキストを返す。
 *
 * @param source - スキャン対象の {@link SourceRepository}。
 */
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

/** `git status --short` の出力を取得する（未追跡はファイル粒度）。 */
const gitStatusShort = (): string => runCommand("git", ["status", "--short", "--untracked-files=all"]).stdout.trim();

/**
 * `git status --short` の 1 行から、変更対象のファイルパスを取り出す。
 *
 * @param line - status の 1 行。
 */
const pathFromStatusLine = (line: string): string => {
  const rawPath = line.match(/^.. ?(.+)$/u)?.[1] ?? line.trim();
  return rawPath.includes(" -> ") ? (rawPath.split(" -> ").at(-1) ?? rawPath) : rawPath;
};

/** 変更・未追跡として `git status` に現れるファイルパスを重複なく列挙する。 */
const gitChangedNames = (): string[] => [
  ...new Set(
    gitStatusShort()
      .split(/\r?\n/u)
      .map((line) => line.trimEnd())
      .filter(Boolean)
      .map(pathFromStatusLine),
  ),
];

/** 対象ドキュメントに対するレビュースコープの人間可読パターン一覧。 */
const allowedReviewScope = (docPath: string): string[] =>
  REVIEW_SCOPE_RULES.map((rule) => (rule.pattern === "{docPath}" ? docPath : rule.pattern));

/**
 * 変更ファイルがレビュースコープ（許容変更範囲）に含まれるか。
 *
 * @param file - リポジトリ相対の変更ファイルパス。
 * @param docPath - 対象ビジュアルドキュメント HTML のリポジトリ相対パス。
 */
const matchesScope = (file: string, docPath: string): boolean =>
  REVIEW_SCOPE_RULES.some((rule) => rule.matches(file, docPath));

/** ビジュアルドキュメントページが既にディスク上に存在するかで new / update を返す。 */
const pageStatus = (docPath: string): "new" | "update" =>
  existsSync(path.join(WORKSPACE_ROOT, docPath)) ? "update" : "new";

/**
 * 著者エージェント向けの Markdown ランブック本文を生成する。
 *
 * @param source - 取得済みソースリポジトリ。
 * @param doc - 対象 HTML の相対パスとスラッグ。
 * @param inventory - インベントリスクリプトの出力テキスト。
 */
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

/**
 * ランブックを `tmp/<slug>-runbook.md` に書き込み、リポジトリ相対パスを返す。
 *
 * @param doc - スラッグ（ファイル名のベース）。
 * @param content - マークダウン全文。
 */
const writeRunbook = async ({ doc, content }: { doc: Pick<DocumentPath, "slug">; content: string }): Promise<string> => {
  const runbookDir = path.join(WORKSPACE_ROOT, "tmp");
  const runbookPath = path.join(runbookDir, `${doc.slug}-runbook.md`);
  await mkdir(runbookDir, { recursive: true });
  await writeFile(runbookPath, content, "utf8");
  return relativeFromRoot(runbookPath);
};

/**
 * `prepare` コマンド本体: ソース取得、スキャン、ランブック出力。
 *
 * @param options - CLI オプション。
 * @returns 成功時はソースパス、ドキュメントパス、ページ状態、ランブック相対パスなど。
 */
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

/** HTML 文字列から `<head>...</head>` 内のマークアップを抽出する。 */
const headContent = (html: string): string => html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/iu)?.[1] ?? "";

/** `<head>` 内に `twitter:card` の meta があるか。 */
const hasTwitterCardInHead = (head: string): boolean =>
  /<meta\s+[^>]*name=["']twitter:card["'][^>]*>/iu.test(head);

/** `<head>` 内に指定 `property` の Open Graph meta があるか。 */
const hasOgPropertyInHead = (head: string, property: string): boolean =>
  new RegExp(`<meta\\s+[^>]*property=["']${property}["'][^>]*>`, "iu").test(head);

/**
 * 必須の OGP / Twitter Card メタが `<head>` に含まれるか。
 *
 * @param html - 完全な HTML 文書。
 * @param marker - `og:title` 等、または `twitter:card`。
 */
const hasHeadMeta = (html: string, marker: string): boolean => {
  const head = headContent(html);
  return marker === "twitter:card" ? hasTwitterCardInHead(head) : hasOgPropertyInHead(head, marker);
};

/**
 * `validate-public-paths.sh` に委譲し、公開 HTML にローカルパスが含まれていないか検査する。
 *
 * @param docPath - 検証対象の `docs/` 相対パス。
 */
const validatePublicPaths = (docPath: string): Result<string> => {
  const script = resolveWorkflowScriptPath(PUBLIC_PATH_SCRIPT);
  if (!script.ok) {
    return script;
  }

  const result = runCommand("bash", [script.value, docPath]);
  if (result.status !== 0) {
    return err("Public path validation failed.", { stderr: result.stderr });
  }
  return ok(result.stdout.trim());
};

/** 失敗 {@link Result} の `details` から、表示に使う短いテキストを抜き出す。 */
const failureDetailsText = (details: Record<string, unknown>): string | undefined => {
  const stderr = details.stderr;
  if (typeof stderr === "string") {
    return stderr.trim();
  }

  const script = details.script;
  return typeof script === "string" ? script : undefined;
};

/**
 * 公開パス検証の失敗を {@link ValidationFinding} にマッピングする（インフラエラーコードを区別）。
 *
 * @param result - `ok: false` の {@link Result}。
 */
const publicPathFinding = (result: Extract<Result<string>, { ok: false }>): ValidationFinding =>
  ValidationFindingSchema.parse({
    code: result.details.script ? "public-path-check-failed" : "public-path-leak",
    message: result.message,
    details: failureDetailsText(result.details),
  });

/** ローカルワークスペース向けの既定 {@link ReviewGateEnvironment} を組み立てる。 */
const createReviewGateEnvironment = (): ReviewGateEnvironment => ({
  changedNames: gitChangedNames,
  exists: existsSync,
  readText: async (absolutePath) => readFile(absolutePath, "utf8"),
  validatePublicPaths,
});

/**
 * レビューゲート（存在・index リンク・head メタ・公開パス・git スコープ）を評価する。
 *
 * @param doc - 正規化済みの {@link DocumentPath}。
 * @param environment - テスト用に差し替え可能。省略時は {@link createReviewGateEnvironment}。
 * @returns 違反の列（空なら合格）。
 */
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

/**
 * `validate` コマンド本体: ファイルは変更せず、レビューゲートの結果だけ返す。
 *
 * @param options - `doc` 必須の CLI オプション。
 */
const validate = async (options: CliOptions): Promise<Result<{ doc: string }>> => {
  if (!options.doc) {
    return err("validate requires --doc.");
  }

  const doc = normalizeDocPath(options.doc);
  const findings = await evaluateReviewGate(doc);

  if (findings.length > 0) {
    return err("Review Gate failed.", { findings });
  }
  return ok({ doc: doc.relativePath });
};

/**
 * {@link Result} を JSON 文字列化する（人間・エージェント向けの安定した形）。
 *
 * @typeParam T - 成功時の値の型。
 * @param result - 成功または失敗の Result。
 */
const formatResult = <T>(result: Result<T>): string => {
  if (result.ok) {
    return JSON.stringify({ ok: true, ...result.value }, null, 2);
  }
  return JSON.stringify({ ok: false, message: result.message, ...result.details }, null, 2);
};

/**
 * argv を解釈し `prepare` または `validate` を実行して CLI 向け {@link Result} を返す。
 *
 * @param argv - 通常は `process.argv.slice(2)`。
 */
const runWorkflow = async (argv: string[]): Promise<Result<Record<string, unknown>>> => {
  try {
    const { command, options } = await collectCliArgs(argv);
    if (command === "prepare") {
      return await prepare(options);
    }
    if (command === "validate") {
      return await validate(options);
    }
    return err("Unknown command. Use prepare or validate.");
  } catch (error) {
    return err(error instanceof Error ? error.message : String(error));
  }
};

/**
 * エントリポイント: ワークフローを実行し終了コードを返す（成功 0 / 失敗 1）。
 *
 * @param argv - `process.argv.slice(2)` と同等。
 */
const main = async (argv: string[]): Promise<number> => {
  const result = await runWorkflow(argv);

  if (result.ok) {
    print(formatResult(result));
    return 0;
  }

  printError(formatResult(result));
  return 1;
};

/** `tsx` で本ファイルが直接実行されたときだけ `main` を起動する。 */
const isDirectRun = process.argv[1] ? path.basename(process.argv[1]) === "visual-doc-workflow.ts" : false;
if (isDirectRun) {
  main(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}

/**
 * 単体テストや外部ツール向けに公開するシンボル。
 */
export {
  basenameFromUrl,
  boundedSlug,
  branchFromOriginHeadRef,
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

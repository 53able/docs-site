# Docs Site Publishing

This context describes the publishing workflow that turns source repositories into visual documentation pages for the docs site.

## Language

**Source Repository**:
A cloned repository under `repos` that is used as the source material for one visual documentation page.
_Avoid_: Input, target, arbitrary repository

**Source Acquisition**:
The step that ensures the source repository exists locally and is synchronized to the latest `origin/HEAD` default branch when it was already cloned.
_Avoid_: Shallow sync, unchecked local reuse

**Source Inventory**:
The scan output that summarizes the source repository structure and key files before documentation authoring begins.
_Avoid_: Full source dump, independent scanner

**Blocked Source Repository**:
A source repository that cannot be used because it is not a valid git clone with an `origin` remote.
_Avoid_: Dirty-tree stop, fast-forward-only gate

**Single Repository Workflow**:
A workflow that takes exactly one selected repository under `repos` as the source and produces a reviewed documentation update.
_Avoid_: Batch workflow, full sync

**Requested Documentation Run**:
A single execution explicitly requested for one source repository, regardless of whether its page already exists.
_Avoid_: Change detection, auto refresh

**Workflow CLI**:
A repository-owned TypeScript command under `scripts` that coordinates a requested documentation run through `tsx`.
_Avoid_: Skill script, GitHub Action, one-off shell command

**Prepare Mode**:
The workflow CLI mode that normalizes the source repository and produces a documentation runbook before authoring starts.
_Avoid_: Generate mode, author mode

**Validate Mode**:
The workflow CLI mode that checks the documentation page, index entry, public path safety, and review handoff readiness after authoring.
_Avoid_: PR mode, deploy mode

**Validation Finding**:
A reported workflow issue with enough context for an authoring agent or developer to fix it.
_Avoid_: Auto fix, patch

**Review Gate**:
The required validation set that must pass before a documentation update is ready for commit and draft pull request handoff.
_Avoid_: Smoke test, optional check

**Review Scope**:
The allowed set of changed files for a reviewable documentation update or workflow automation update.
_Avoid_: Unbounded diff, unrelated changes

**Documentation Authoring**:
The judgment-heavy work of reading a source repository and writing or updating its visual documentation page.
_Avoid_: CLI generation, template fill

**Workflow Coordination**:
The deterministic work around documentation authoring, including source acquisition, validation, branch handling, and review handoff.
_Avoid_: Content writing, visual design

**Documentation Runbook**:
A generated Markdown handoff that summarizes the normalized source, page status, branch suggestion, checks, and authoring prompt for one requested documentation run.
_Avoid_: Execution log, design doc, generated page

**Runbook Name**:
The documentation slug based name used for the unversioned runbook of a requested documentation run.
_Avoid_: Timestamp archive, random ID

**Authoring Handoff**:
The runbook section that gives an authoring agent the source, page status, naming suggestion, required references, review gate, and pre-PR cautions without prescribing the full final prompt.
_Avoid_: Full generated prompt, vague instruction

**Naming Suggestion**:
A workflow CLI proposal for the documentation file name and branch name derived from the source repository name.
_Avoid_: Final name, created branch

**Naming Override**:
An explicit user-provided documentation or clone name that replaces the workflow CLI naming suggestion.
_Avoid_: Silent truncation, rule bypass

**Document Path Normalization**:
The workflow CLI rule that accepts a documentation slug or path and resolves it to one canonical path under `docs`.
_Avoid_: Strict path-only input, ambiguous doc target

**Workflow Design Document**:
A versioned design document that records the workflow automation decisions independent of any single run.
_Avoid_: Runbook, execution note

**Visual Documentation Page**:
A public HTML page under `docs` generated from a source repository to explain that repository visually.
_Avoid_: Generated artifact, standalone HTML

**Reviewable Documentation Update**:
A branch and draft pull request containing one visual documentation change plus its index entry and validation evidence.
_Avoid_: Finished publication, direct publish

## Relationships

- A GitHub URL or existing `repos` path is normalized into exactly one **Source Repository**
- **Source Acquisition** creates or synchronizes exactly one **Source Repository**
- **Source Acquisition** stops when it encounters a **Blocked Source Repository**
- A **Single Repository Workflow** runs against exactly one **Source Repository**
- A **Single Repository Workflow** starts from exactly one **Requested Documentation Run**
- A **Workflow CLI** performs **Workflow Coordination** for a **Requested Documentation Run**
- A **Workflow CLI** exposes **Prepare Mode** before **Documentation Authoring** and **Validate Mode** after **Documentation Authoring**
- A **Workflow CLI** produces one **Documentation Runbook** for a **Requested Documentation Run**
- A **Documentation Runbook** includes one **Source Inventory**
- A **Documentation Runbook** includes one **Authoring Handoff**
- A **Documentation Runbook** uses a **Runbook Name** derived from the documentation slug
- A **Documentation Runbook** includes a **Naming Suggestion**
- A **Naming Override** can replace a **Naming Suggestion** when the source name is too long or unclear
- **Validate Mode** uses **Document Path Normalization** before evaluating a documentation page
- **Validate Mode** evaluates the **Review Gate**
- **Validate Mode** warns when the git diff falls outside the **Review Scope**
- **Validate Mode** reports **Validation Findings** rather than modifying files
- A **Workflow Design Document** records decisions that apply across **Requested Documentation Run** executions
- **Documentation Authoring** produces the **Visual Documentation Page** change within the **Single Repository Workflow**
- A **Single Repository Workflow** produces zero or one **Reviewable Documentation Update** per run
- A **Reviewable Documentation Update** contains zero or one **Visual Documentation Page** update
- A **Visual Documentation Page** is published through the docs site's GitHub Pages deployment after review

## Example dialogue

> **Dev:** "Should this automation scan every cloned repository?"
> **Domain expert:** "No. The first version is a **Single Repository Workflow**: choose one **Source Repository**, update its **Visual Documentation Page**, then open a **Reviewable Documentation Update**."

## Flagged ambiguities

- "自動化" was broad enough to mean batch processing, queue processing, or URL-to-PR processing; resolved: the first target is **Single Repository Workflow**.
- "公開まで" could mean direct publication after merge or review handoff; resolved: the workflow stops at a **Reviewable Documentation Update**.
- "入力" could mean a local path or remote URL; resolved: both are allowed but must normalize to a **Source Repository**.
- "更新必要" could imply automatic change detection; resolved: the first version only runs when there is a **Requested Documentation Run**.
- "実装するもの" could mean skill, shell script, or CI workflow; resolved: the first version is a **Workflow CLI**.
- "自動生成" could mean deterministic CLI content generation; resolved: **Documentation Authoring** remains agent-led while the **Workflow CLI** handles **Workflow Coordination**.
- "CLIの出力" could mean logs, prompts, or direct agent execution; resolved: the CLI produces a **Documentation Runbook**.
- "保存するもの" could mix reusable decisions with per-run handoffs; resolved: reusable decisions belong in a **Workflow Design Document**, while per-run handoffs remain unversioned.
- "CLIモード" could expand into authoring, PR, and deployment; resolved: the first version has **Prepare Mode** and **Validate Mode** only.
- "検証" could include auto-remediation; resolved: **Validate Mode** only emits **Validation Findings**.
- "取得" could mean shallow clone, full clone, pull, or local reuse; resolved: **Source Acquisition** uses full clone for new sources and forced `origin/HEAD` synchronization for existing sources.
- "取得失敗" could trigger stash, fallback clone, or unsafe reuse; resolved: fetch or sync failures return explicit errors, while missing `.git` or `origin` becomes a **Blocked Source Repository**.
- "命名" could mean final branch creation or doc creation; resolved: the **Workflow CLI** only emits a **Naming Suggestion**.
- "検証範囲" could mean a shallow existence check; resolved: **Validate Mode** evaluates the full **Review Gate** before review handoff.
- "`validate --doc` input" could require an exact path or a slug; resolved: **Document Path Normalization** accepts common forms and resolves them to one canonical path.
- "authoring prompt" could mean a vague instruction or a fully frozen prompt; resolved: the runbook contains a medium-granularity **Authoring Handoff**.
- "差分対象" could allow unrelated repository edits; resolved: **Validate Mode** checks changes against the **Review Scope** and warns on out-of-scope files.
- "長い名前" could be silently truncated; resolved: the CLI emits a bounded **Naming Suggestion** and allows an explicit **Naming Override**.
- "source scan" could be skipped or duplicated in the CLI; resolved: **Prepare Mode** reuses the existing scan script and records a **Source Inventory**.
- "runbook filename" could optimize for history or lookup; resolved: the **Runbook Name** is slug-based and may be overwritten by later runs.

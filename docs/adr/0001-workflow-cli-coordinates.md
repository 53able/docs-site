# Workflow CLI coordinates documentation runs

The visual documentation workflow is automated with a repository-owned TypeScript CLI, executed through `tsx`, for deterministic coordination, while documentation authoring remains agent-led through the existing docs-site visual documentation skill. We chose this split because source interpretation, visual structure, and prose quality require judgment, while source acquisition, runbook generation, validation, and review handoff benefit from repeatable CLI checks.

## Considered Options

- Build the whole HTML generation process into the CLI.
- Run the workflow entirely as a GitHub Actions job.
- Keep the process as an agent-only skill with no repository-owned command.

## Consequences

- The CLI must not become the visual documentation author.
- The CLI should provide prepare and validate modes around the authoring step.
- Reviewable updates still end as draft pull requests rather than direct publication.

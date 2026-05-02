#!/usr/bin/env bash
# Thin wrapper: docs-site-add-visual-doc はリポジトリルートの
# `scripts/validate-public-paths.sh` 実行を想定している。実装本体はスキル配下。
#
# Usage (from repo root):
#   bash scripts/validate-public-paths.sh docs/<name>.html
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec bash "$ROOT/.cursor/skills/docs-site-add-visual-doc/scripts/validate-public-paths.sh" "$@"

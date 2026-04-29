#!/usr/bin/env bash
# validate-public-paths.sh — docs-site の公開HTMLにローカルパスが漏れていないか検査する
#
# 使い方（ワークスペースルートから）:
#   bash .cursor/skills/docs-site-add-visual-doc/scripts/validate-public-paths.sh docs/<name>.html
#
# 出力:
#   stdout: 検査結果（成功時）
#   stderr: 検出箇所と修正方針（失敗時）

set -euo pipefail

HTML_FILE="${1:-}"

if [[ -z "$HTML_FILE" ]]; then
  echo "ERROR: HTML file not specified." >&2
  echo "Usage: bash .cursor/skills/docs-site-add-visual-doc/scripts/validate-public-paths.sh docs/<name>.html" >&2
  exit 1
fi

if [[ ! -f "$HTML_FILE" ]]; then
  echo "ERROR: HTML file not found: $HTML_FILE" >&2
  exit 1
fi

if ! command -v rg >/dev/null 2>&1; then
  echo "ERROR: ripgrep (rg) is required for path validation." >&2
  exit 1
fi

LOCAL_PATH_PATTERN='(/Users/|/home/|/private/var/|/var/folders/|[A-Za-z]:\\)'
REPOS_PATH_PATTERN='(^|[^[:alnum:]_-])repos/[A-Za-z0-9._/-]+'

HAS_ERROR=0

if rg -n "$LOCAL_PATH_PATTERN" "$HTML_FILE" >&2; then
  echo "ERROR: Local absolute path found. Replace it with a public URL, project slug, or repository-relative path." >&2
  HAS_ERROR=1
fi

if rg -n "$REPOS_PATH_PATTERN" "$HTML_FILE" >&2; then
  echo "ERROR: Workspace source path found. Replace repos/<name>/... with a public project slug or repository-relative path." >&2
  HAS_ERROR=1
fi

if [[ "$HAS_ERROR" -ne 0 ]]; then
  exit 1
fi

echo "OK: no local or workspace source paths found in $HTML_FILE"

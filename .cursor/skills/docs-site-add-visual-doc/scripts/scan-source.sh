#!/usr/bin/env bash
# scan-source.sh — ソースディレクトリの構造・ファイル情報を出力する
#
# 使い方（ワークスペースルートから）:
#   bash .cursor/skills/docs-site-add-visual-doc/scripts/scan-source.sh <source-dir>
#
# 出力:
#   stdout: ディレクトリ構造 + ファイル情報（エージェントの Phase 1 判断用）
#   stderr: エラーメッセージ（失敗時のみ）
#
# Context Engineering 用途:
#   - 何を読むか（優先度）の判断材料を最小コストで取得する
#   - git の .gitignore を無視して repos/ 以下も確実にスキャンする

set -euo pipefail

SOURCE_DIR="${1:-}"

# ── Validation ──────────────────────────────────────────────
if [[ -z "$SOURCE_DIR" ]]; then
  echo "ERROR: Source directory not specified." >&2
  echo "Usage: bash .cursor/skills/docs-site-add-visual-doc/scripts/scan-source.sh <source-dir>" >&2
  exit 1
fi

if [[ ! -d "$SOURCE_DIR" ]]; then
  echo "ERROR: Directory not found: $SOURCE_DIR" >&2
  echo "NOTE: If path contains repos/, Glob tools may miss it (.gitignore). Use direct path." >&2
  exit 1
fi

# ── Header ──────────────────────────────────────────────────
echo "=== SCAN: $SOURCE_DIR ==="
echo ""

# ── Directory tree (2 levels) ──────────────────────────────
echo "--- Directory Structure ---"
if command -v tree &>/dev/null; then
  tree -L 2 --noreport "$SOURCE_DIR" 2>/dev/null || find "$SOURCE_DIR" -maxdepth 2 | sort
else
  find "$SOURCE_DIR" -maxdepth 2 | sort
fi
echo ""

# ── File inventory with sizes ───────────────────────────────
echo "--- File Inventory (sorted by size desc) ---"
find "$SOURCE_DIR" -type f \( \
  -name "*.md" -o -name "*.html" -o -name "*.ts" -o \
  -name "*.js" -o -name "*.py" -o -name "*.sh" -o \
  -name "*.json" -o -name "*.yaml" -o -name "*.yml" \
\) | while read -r f; do
  size=$(wc -l < "$f" 2>/dev/null || echo "?")
  echo "$size lines  $f"
done | sort -rn
echo ""

# ── Key files detection ─────────────────────────────────────
echo "--- Key Files Detected ---"
KEY_FILES=(
  "README.md" "readme.md"
  "SKILL.md" "skill.md"
  "index.ts" "index.js" "index.py" "main.ts" "main.js" "main.py"
  "package.json" "pyproject.toml" "Cargo.toml"
)

for kf in "${KEY_FILES[@]}"; do
  candidate="$SOURCE_DIR/$kf"
  if [[ -f "$candidate" ]]; then
    lines=$(wc -l < "$candidate")
    echo "FOUND [$lines lines] $candidate"
  fi
done

# Check subdirs for nested key files
find "$SOURCE_DIR" -mindepth 2 -maxdepth 3 -name "SKILL.md" -o \
     -mindepth 2 -maxdepth 3 -name "README.md" 2>/dev/null | while read -r f; do
  lines=$(wc -l < "$f")
  echo "NESTED [$lines lines] $f"
done
echo ""

# ── Reading priority recommendation ────────────────────────
echo "--- Recommended Reading Order (JiT Priority) ---"
echo "Priority 1 (always): Directory structure above"
echo "Priority 2 (always): README.md if found"
echo "Priority 3 (always): SKILL.md / index.* / main.* if found"
echo "Priority 4-6 (JiT):  references/ assets/ scripts/ — read only if structured extraction needs detail"
echo ""
echo "=== END SCAN ==="

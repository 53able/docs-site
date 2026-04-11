#!/usr/bin/env python3
# 本スキル内パス: ./scripts/verify-docs-repos-gap.py（カレント = docs-site-repos-sync/）
# 実行例（リポジトリルート）: SKILL=./.cursor/skills/docs-site-repos-sync && python3 "$SKILL/scripts/verify-docs-repos-gap.py"
# 互換: python3 ./tmp/verify-docs-repos-gap.py（tmp から本ファイルへ委譲）
# 出力: docs/*.html の解説対象（1 ページ 1 本）と repos/ の差分（未クローン一覧）。
# repos/ は .gitignore のため、このスクリプトで実ディレクトリを読む。

from __future__ import annotations

import re
import pathlib
import sys


def find_docs_site_root() -> pathlib.Path:
    """スクリプトの配置に依存せず、親を辿って docs/ があるリポジトリルートを返す。"""
    for p in pathlib.Path(__file__).resolve().parents:
        if (p / "docs").is_dir():
            return p
    print("ERROR: docs-site root (directory containing docs/) not found", file=sys.stderr)
    raise SystemExit(1)


ROOT = find_docs_site_root()
DOCS = ROOT / "docs"
REPOS = ROOT / "repos"

OVERRIDE: dict[str, tuple[str, str]] = {
    "kaku-repo.html": ("tw93", "Kaku"),
    "hermes-agent.html": ("NousResearch", "hermes-agent"),
    "page-agent.html": ("alibaba", "page-agent"),
    "agent-skills.html": ("addyosmani", "agent-skills"),
    "agentskills.html": ("agentskills", "agentskills"),
    "DeepTutor.html": ("HKUDS", "DeepTutor"),
    "Waza.html": ("tw93", "Waza"),
    "awesome-design-md.html": ("VoltAgent", "awesome-design-md"),
    "harness.html": ("revfactory", "harness"),
    "ink.html": ("vadimdemedes", "ink"),
    "nanobot.html": ("HKUDS", "nanobot"),
    "oh-my-claudecode.html": ("Yeachan-Heo", "oh-my-claudecode"),
    "oh-my-openagent.html": ("code-yeongyu", "oh-my-openagent"),
    "stop-slop.html": ("hardikpandya", "stop-slop"),
    "xyflow.html": ("xyflow", "xyflow"),
}

PRIORITY = (
    "本解説のソース",
    "本体リポジトリ",
    "ソースリポジトリ",
    "本ページの解説元",
    "本リポジトリ",
    "リポジトリ本体",
    "このガイドのソースリポジトリ",
    "リポジトリ（",
    "ソースコード",
)

LINK_LINE = re.compile(
    r'<a\s+[^>]*href="https://github\.com/([^"/]+)/([^"/?#]+)[^"]*"[^>]*>([^<]*)</a>(.*)$'
)


def match_folder(
    repos_dirs: set[str],
    repos_lower: dict[str, str],
    owner: str,
    repo: str,
) -> str | None:
    o, r = owner.lower(), repo.lower()
    variants = [
        repo,
        f"{owner}-{repo}",
        f"{o}-{r}",
        f"{repo}-main",
        f"{repo}-master",
        r,
    ]
    for v in variants:
        if v in repos_dirs:
            return v
        vl = v.lower()
        if vl in repos_lower:
            return repos_lower[vl]
    return None


def extract_canonical(path: pathlib.Path) -> str | None:
    if path.name in OVERRIDE:
        o, r = OVERRIDE[path.name]
        return f"{o}/{r}"
    text = path.read_text(encoding="utf-8", errors="replace")
    best: list[tuple[int, int, str, str]] = []
    for i, line in enumerate(text.splitlines()):
        m = LINK_LINE.search(line)
        if not m:
            continue
        owner, repo, inner, _after = m.group(1), m.group(2), m.group(3), m.group(4)
        inner_l = inner.lower()
        score = 0
        if "github:" in inner_l and f"{owner.lower()}/{repo.lower()}" in inner_l.replace(" ", ""):
            score += 5
        for idx, pe in enumerate(PRIORITY):
            if pe in line:
                score = max(score, 200 - idx)
        if score == 0 and "GitHub:" in inner:
            score = 1
        if score > 0:
            best.append((score, i, owner, repo))
    if not best:
        m = re.search(r'class="subtitle"[^>]*>github\.com/([^/]+)/([^<\s—]+)', text)
        if m:
            return f"{m.group(1)}/{m.group(2)}"
        m = re.search(
            r'<strong>リポジトリ</strong>[：:]\s*<a[^>]+href="https://github\.com/([^/]+)/([^"/]+)',
            text,
        )
        if m:
            return f"{m.group(1)}/{m.group(2)}"
        m = re.search(
            r'<strong>リポジトリ</strong>：<a[^>]+href="https://github\.com/([^/]+)/([^"/]+)',
            text,
        )
        if m:
            return f"{m.group(1)}/{m.group(2)}"
        return None
    best.sort(key=lambda x: (-x[0], x[1]))
    o, r = best[0][2], best[0][3]
    return f"{o}/{r}"


def main() -> int:
    if not DOCS.is_dir():
        print("ERROR: docs/ not found", file=sys.stderr)
        return 1
    if not REPOS.is_dir():
        print("ERROR: repos/ not found", file=sys.stderr)
        return 1
    repos_dirs = {p.name for p in REPOS.iterdir() if p.is_dir()}
    repos_lower = {x.lower(): x for x in repos_dirs}
    docs = sorted(DOCS.glob("*.html"))
    not_cloned: list[tuple[str, str | None]] = []
    for p in docs:
        ref = extract_canonical(p)
        if not ref:
            not_cloned.append((p.name, None))
            continue
        o, r = ref.split("/", 1)
        if not match_folder(repos_dirs, repos_lower, o, r):
            not_cloned.append((p.name, ref))
    unresolved = [x for x in not_cloned if x[1] is None]
    missing = [x for x in not_cloned if x[1] is not None]
    print(f"docs pages: {len(docs)}")
    print(f"unresolved (no canonical GitHub): {len(unresolved)}")
    print(f"not cloned under repos/: {len(missing)}")
    print()
    for fn, ref in sorted(missing, key=lambda x: (x[1] or "", x[0])):
        print(f"{ref}\t{fn}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

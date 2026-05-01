#!/usr/bin/env python3
"""
Inject <!-- source-repo-commit --> and 解説時点のソース ve-card into docs/*.html.
Scope (A): version metadata only; no README body rewrite.

Run from repo root:
  python3 .cursor/skills/docs-site-repos-sync/scripts/inject-source-version-blocks.py

Reuses owner/repo resolution aligned with verify-docs-repos-gap.py.
"""
from __future__ import annotations

import importlib.util
import pathlib
import re
import subprocess
import sys
import tempfile


def find_docs_site_root() -> pathlib.Path:
    for p in pathlib.Path(__file__).resolve().parents:
        if (p / "docs").is_dir():
            return p
    raise RuntimeError("docs-site root (directory containing docs/) not found")


ROOT = find_docs_site_root()
DOCS = ROOT / "docs"
REPOS = ROOT / "repos"
_VGAP_PATH = ROOT / ".cursor/skills/docs-site-repos-sync/scripts/verify-docs-repos-gap.py"


def _load_vgap():
    spec = importlib.util.spec_from_file_location("verify_docs_repos_gap", _VGAP_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load {_VGAP_PATH}")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


vgap = _load_vgap()


def git_out(repo: pathlib.Path, *args: str) -> str:
    r = subprocess.run(
        ["git", "-C", str(repo), *args],
        capture_output=True,
        text=True,
        check=False,
    )
    return (r.stdout or "").strip()


def git_meta(repo: pathlib.Path) -> dict[str, str] | None:
    """現在の作業ツリーの HEAD メタを読む。リモート追従は repos-pull-latest 等で事前に行う。"""
    if not (repo / ".git").exists():
        return None
    short = git_out(repo, "rev-parse", "--short=7", "HEAD")
    if not short:
        return None
    desc = git_out(repo, "describe", "--tags", "--always", "--long")
    if not desc:
        desc = short
    branch = git_out(repo, "rev-parse", "--abbrev-ref", "HEAD")
    date = git_out(repo, "log", "-1", "--format=%ci")
    return {
        "short": short,
        "describe": desc,
        "branch": branch,
        "date": date,
    }


def git_meta_shallow_clone(owner: str, repo: str) -> dict[str, str] | None:
    """When repos/<folder> is a plain copy without .git, shallow-clone for metadata only."""
    url = f"https://github.com/{owner}/{repo}.git"
    with tempfile.TemporaryDirectory(prefix="docs-site-meta-") as td:
        path = pathlib.Path(td)
        r = subprocess.run(
            ["git", "clone", "--depth", "1", url, str(path)],
            capture_output=True,
            text=True,
            check=False,
        )
        if r.returncode != 0:
            return None
        return git_meta(path)


def github_https(owner: str, repo: str) -> str:
    return f"https://github.com/{owner}/{repo}"


def build_card(
    indent: str,
    short: str,
    desc: str,
    branch: str,
    date: str,
    owner: str,
    repo: str,
    folder: str,
) -> str:
    gh = github_https(owner, repo)
    return (
        f'{indent}<div class="ve-card ve-card--recessed" style="--i:0; margin-bottom:1.5rem;">\n'
        f'{indent}  <span class="ve-section-label"><span class="ve-dot"></span> 解説時点のソース</span>\n'
        f'{indent}  <p style="font-size:0.875rem; color: var(--text-dim); margin-bottom:0.5rem;">\n'
        f"{indent}    <strong>コミット</strong> {short} · <strong>describe</strong> {desc} · "
        f"<strong>ブランチ</strong> {branch} · <strong>コミット日時</strong> {date}\n"
        f'{indent}  </p>\n'
        f'{indent}  <p style="font-size:0.8125rem; color: var(--text-dim); margin-bottom:0;">\n'
        f'{indent}    リポジトリ参照: <a href="{gh}" target="_blank" rel="noopener">github.com/{owner}/{repo}</a> · '
        f"ローカル: <code>repos/{folder}</code>\n"
        f"{indent}  </p>\n"
        f"{indent}</div>\n"
    )


def main_anchor_pattern() -> re.Pattern[str]:
    return re.compile(r'<(?:div|main)\s+class="main">')


def detect_indent(html: str) -> str:
    m = re.search(r"(?m)^(\s*)<p class=\"subtitle\"", html)
    if m:
        return m.group(1) or "  "
    m = main_anchor_pattern().search(html)
    if not m:
        return "  "
    pos = m.end()
    for line in html[pos : pos + 600].splitlines():
        if line.strip():
            im = re.match(r"^(\s*)", line)
            return im.group(1) if im else "  "
    return "  "


# 既存の「解説時点のソース」カード（1 枚）を置換する。構造は build_card と一致させること。
# インデントは水平空白のみ（\s だと直前の改行まで取り込み、build_card 各行先頭に余計な空行が付く）
SOURCE_VERSION_CARD_RE = re.compile(
    r"([ \t]*)<div class=\"ve-card ve-card--recessed\"[^>]*>\s*"
    r"<span class=\"ve-section-label\"><span class=\"ve-dot\"></span> 解説時点のソース</span>"
    r"[\s\S]*?</div>",
    re.DOTALL,
)


def apply_file(path: pathlib.Path, repos_dirs: set[str], repos_lower: dict[str, str]) -> str | None:
    text = path.read_text(encoding="utf-8")
    ref = vgap.extract_canonical(path)
    if not ref:
        return f"skip {path.name}: no canonical ref"
    owner, repo = ref.split("/", 1)
    folder = vgap.match_folder(repos_dirs, repos_lower, owner, repo)
    if not folder:
        return f"skip {path.name}: no repos folder for {ref}"
    repo_path = REPOS / folder
    meta = git_meta(repo_path)
    if not meta:
        meta = git_meta_shallow_clone(owner, repo)
    if not meta:
        return f"skip {path.name}: git meta failed for repos/{folder}"

    short = meta["short"]
    indent = detect_indent(text)
    m_card = SOURCE_VERSION_CARD_RE.search(text)
    if m_card and m_card.group(1) is not None:
        indent = m_card.group(1)
    card = build_card(
        indent,
        short,
        meta["describe"],
        meta["branch"],
        meta["date"],
        owner,
        repo,
        folder,
    )

    had_comment = "source-repo-commit:" in text
    had_card = "解説時点のソース" in text and m_card is not None

    # ヘッドコメントを常に現在の short に合わせる
    if had_comment:
        text, n_sub = re.subn(
            r"<!--\s*source-repo-commit:\s*[a-fA-F0-9]+\s*-->",
            f"<!-- source-repo-commit: {short} -->",
            text,
            count=1,
        )
        if n_sub == 0:
            text = re.sub(r"(<head>)", r"\1\n" + f"  <!-- source-repo-commit: {short} -->\n", text, count=1)
    else:
        text = re.sub(r"(<head>)", r"\1\n" + f"  <!-- source-repo-commit: {short} -->\n", text, count=1)

    if had_card:
        new_text, n_card = SOURCE_VERSION_CARD_RE.subn(card, text, count=1)
        if n_card == 0:
            return f"skip {path.name}: could not replace 解説時点のソース card"
        text = new_text
    else:
        sub_full = re.search(r"<p class=\"subtitle\"[^>]*>.*?</p>", text, re.DOTALL)
        if sub_full:
            end = sub_full.end()
            text = text[:end] + "\n\n" + card + text[end:]
        else:
            m = main_anchor_pattern().search(text)
            if not m:
                return f"skip {path.name}: no insertion anchor"
            pos = m.end()
            text = text[:pos] + "\n\n" + card + text[pos:]

    path.write_text(text, encoding="utf-8")
    return None


def main() -> int:
    if not DOCS.is_dir():
        print("ERROR: docs/", file=sys.stderr)
        return 1
    repos_dirs = {p.name for p in REPOS.iterdir() if p.is_dir()}
    repos_lower = {x.lower(): x for x in repos_dirs}
    errors: list[str] = []
    for p in sorted(DOCS.glob("*.html")):
        err = apply_file(p, repos_dirs, repos_lower)
        if err:
            errors.append(err)
    for e in errors:
        print(e, file=sys.stderr)
    print(f"done. errors/skips: {len(errors)}")
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())

"""MkDocs build hook: render the Changelog timeline from the repo's CHANGELOG.md.

Keeps a single source of truth — the changelog page (`docs/changelog.md`) carries
only an intro plus a `<!-- KI_CHANGELOG -->` marker, and this hook replaces that
marker at build time with a timeline of all releases parsed from CHANGELOG.md.

Each version's body is left as Markdown wrapped in HTML (md_in_html is enabled in
mkdocs.yml), so the `### Added/Changed/...` bullets render with the normal theme.
"""

import os
import re

import markdown as _md

MARKER = "<!-- KI_CHANGELOG -->"

# "## [v0.6.3-alpha] - 2026-06-27"
_VERSION_RE = re.compile(r"^##\s+\[(?P<ver>[^\]]+)\]\s*(?:-\s*(?P<date>.+))?$")
# "### Added" / "### Changed" / ...
_SECTION_RE = re.compile(r"^###\s+(?P<name>.+?)\s*$")


def _read_changelog(config):
    """Return the raw CHANGELOG.md text, or None if it can't be found."""
    root = os.path.dirname(config["config_file_path"])
    path = os.path.join(root, "CHANGELOG.md")
    try:
        with open(path, "r", encoding="utf-8") as fh:
            return fh.read()
    except OSError:
        return None


def _parse_versions(text):
    """Split CHANGELOG.md into a list of {ver, date, body} dicts (newest first)."""
    versions = []
    current = None
    body_lines = []

    def flush():
        if current is not None:
            current["body"] = "\n".join(body_lines).strip()
            versions.append(current)

    for line in text.splitlines():
        m = _VERSION_RE.match(line)
        if m:
            flush()
            current = {
                "ver": m.group("ver").strip(),
                "date": (m.group("date") or "").strip(),
            }
            body_lines = []
            continue
        if current is None:
            continue
        # Drop the horizontal-rule separators between versions.
        if line.strip() == "---":
            continue
        body_lines.append(line)

    flush()
    return versions


def _summary(body):
    """A short '3 added · 1 changed' style summary from the version's sections."""
    counts = []
    name = None
    n = 0
    sections = []

    def push():
        if name is not None:
            sections.append((name, n))

    for line in body.splitlines():
        m = _SECTION_RE.match(line)
        if m:
            push()
            name = m.group("name")
            n = 0
            continue
        if name is not None and line.strip().startswith("- "):
            n += 1
    push()

    for name, n in sections:
        if n:
            counts.append(f"{n} {name.lower()}")
    return " · ".join(counts)


def _render_body(body):
    """Render a version's Markdown body to HTML (own converter, no md_in_html)."""
    return _md.markdown(body, extensions=["extra"])


def _build_timeline(versions):
    out = ['<div class="ki-cl-timeline">']
    for i, v in enumerate(versions):
        is_latest = i == 0
        open_cls = " is-open" if is_latest else ""
        badge = '<span class="ki-cl-badge">Latest</span>' if is_latest else ""
        summary = _summary(v["body"])
        summary_html = (
            f'<span class="ki-cl-summary">{summary}</span>' if summary else ""
        )
        date_html = (
            f'<span class="ki-cl-date">{v["date"]}</span>' if v["date"] else ""
        )
        out.append(f'<section class="ki-cl-item ki-reveal{open_cls}" data-cl-index="{i}">')
        out.append('<span class="ki-cl-node" aria-hidden="true"></span>')
        out.append(
            f'<button type="button" class="ki-cl-head" '
            f'aria-expanded="{"true" if is_latest else "false"}">'
            f'<span class="ki-cl-head-top">'
            f'<span class="ki-cl-ver">{v["ver"]}</span>{badge}'
            f'<span class="ki-cl-chevron" aria-hidden="true"></span>'
            f"</span>"
            f'<span class="ki-cl-head-meta">{date_html}{summary_html}</span>'
            f"</button>"
        )
        out.append('<div class="ki-cl-body">')
        out.append(f'<div class="ki-cl-body-inner">{_render_body(v["body"])}</div>')
        out.append("</div>")
        out.append("</section>")
    out.append("</div>")
    return "\n".join(out)


def on_page_markdown(markdown, page, config, files):
    if page.file.src_uri != "changelog.md":
        return markdown
    if MARKER not in markdown:
        return markdown

    text = _read_changelog(config)
    if not text:
        # Graceful fallback: leave a note instead of an empty marker.
        return markdown.replace(
            MARKER, "_Changelog could not be loaded at build time._"
        )

    versions = _parse_versions(text)
    if not versions:
        return markdown.replace(MARKER, "_No releases found._")

    return markdown.replace(MARKER, _build_timeline(versions))

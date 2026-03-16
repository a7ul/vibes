#!/usr/bin/env bash
# analyze-pydantic-release.sh
# Usage: ./analyze-pydantic-release.sh <old_version> <new_version>
# Outputs structured markdown summarizing what changed in pydantic-ai.

set -euo pipefail

OLD_VERSION="${1:-}"
NEW_VERSION="${2:-}"

if [[ -z "$OLD_VERSION" || -z "$NEW_VERSION" ]]; then
  echo "Usage: $0 <old_version> <new_version>" >&2
  exit 1
fi

AUTH_HEADER=""
if [[ -n "${GITHUB_TOKEN:-}" ]]; then
  AUTH_HEADER="Authorization: Bearer $GITHUB_TOKEN"
fi

fetch() {
  if [[ -n "$AUTH_HEADER" ]]; then
    curl -fsSL -H "$AUTH_HEADER" -H "Accept: application/vnd.github+json" "$1"
  else
    curl -fsSL -H "Accept: application/vnd.github+json" "$1"
  fi
}

echo "## Pydantic AI Release: v${OLD_VERSION} → v${NEW_VERSION}"
echo ""
echo "**PyPI**: https://pypi.org/project/pydantic-ai/${NEW_VERSION}/"
echo "**GitHub Release**: https://github.com/pydantic/pydantic-ai/releases/tag/v${NEW_VERSION}"
echo "**Compare**: https://github.com/pydantic/pydantic-ai/compare/v${OLD_VERSION}...v${NEW_VERSION}"
echo ""

# Fetch release notes from GitHub
RELEASE_JSON=$(fetch "https://api.github.com/repos/pydantic/pydantic-ai/releases/tags/v${NEW_VERSION}" 2>/dev/null || echo "{}")
RELEASE_BODY=$(echo "$RELEASE_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('body','_No release notes found._'))" 2>/dev/null || echo "_Could not fetch release notes._")

echo "### Release Notes"
echo ""
echo "$RELEASE_BODY" | sed 's/@\([a-zA-Z0-9_][a-zA-Z0-9_-]*\)/\1/g'
echo ""

# Fetch changed files between tags
COMPARE_JSON=$(fetch "https://api.github.com/repos/pydantic/pydantic-ai/compare/v${OLD_VERSION}...v${NEW_VERSION}" 2>/dev/null || echo "{}")
CHANGED_FILES=$(echo "$COMPARE_JSON" | python3 -c "
import sys, json
d = json.load(sys.stdin)
files = d.get('files', [])
for f in files:
    print(f['filename'])
" 2>/dev/null || echo "")

if [[ -n "$CHANGED_FILES" ]]; then
  echo "### Changed Files in pydantic-ai"
  echo ""
  echo '```'
  echo "$CHANGED_FILES"
  echo '```'
  echo ""

  # Highlight likely-relevant files
  RELEVANT=$(echo "$CHANGED_FILES" | grep -E "(agent|tool|result|stream|model|run|depend|inject|graph|mcp|test)" || true)
  if [[ -n "$RELEVANT" ]]; then
    echo "### Likely Relevant to vibes"
    echo ""
    echo '```'
    echo "$RELEVANT"
    echo '```'
    echo ""
  fi
fi

# Commit count
COMMIT_COUNT=$(echo "$COMPARE_JSON" | python3 -c "
import sys, json
d = json.load(sys.stdin)
commits = d.get('commits', [])
print(len(commits))
" 2>/dev/null || echo "?")

echo "### Stats"
echo ""
echo "- Commits: $COMMIT_COUNT"
echo "- Files changed: $(echo "$CHANGED_FILES" | grep -c . || echo 0)"

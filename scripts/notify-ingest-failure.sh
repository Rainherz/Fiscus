#!/usr/bin/env bash
# Opens (or comments on) an "ingest-failure" GitHub issue when a local systemd user unit fails, with
# the last 50 journal lines of that unit. Meant for OnFailure= (see README, "Monitoring").
#
#   scripts/notify-ingest-failure.sh <unit>       e.g. fiscus-ingest.service
#   scripts/notify-ingest-failure.sh --redact     filter stdin through the redaction only (tests)
#
# Uses the local gh authentication (gh auth login, or GH_TOKEN). The repository is the one this
# script lives in. Anything that looks like a key or token is replaced with [REDACTED] before it
# leaves the machine; only message text is sent (journalctl -o cat: no hostname).
set -euo pipefail

LABEL="ingest-failure"
LINES=50

# Secrets that may appear in logs: JWTs (Supabase anon/service keys), Supabase API keys, GitHub
# tokens, Bearer headers, KEY/TOKEN/SECRET/PASSWORD assignments, and long opaque strings.
redact() {
  sed -E \
    -e 's/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/[REDACTED]/g' \
    -e 's/sb_(secret|publishable)_[A-Za-z0-9_-]+/[REDACTED]/g' \
    -e 's/(gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})/[REDACTED]/g' \
    -e 's/([Bb]earer)[[:space:]]+[^[:space:]"]+/\1 [REDACTED]/g' \
    -e 's/([A-Za-z0-9_]*(KEY|TOKEN|SECRET|PASSWORD|key|token|secret|password)[A-Za-z0-9_]*["]?[[:space:]]*[:=][[:space:]]*["]?)[^[:space:]",]+/\1[REDACTED]/g' \
    -e 's#/home/[^/[:space:]]+#~#g' \
    -e 's/[A-Za-z0-9_-]{40,}/[REDACTED]/g'
}

if [[ "${1:-}" == "--redact" ]]; then
  redact
  exit 0
fi

unit="${1:?usage: notify-ingest-failure.sh <unit>}"
cd "$(dirname "$(readlink -f "$0")")/.."

title="Falló la ingesta: ${unit}"
result="$(systemctl --user show -p Result -p ExecMainStatus --value "$unit" 2>/dev/null | paste -sd ' ' - || true)"
journal="$(journalctl --user -u "$unit" -n "$LINES" -o cat --no-pager 2>&1 | redact)"
# shellcheck disable=SC2016 # backticks are Markdown, not command substitution
body="$(printf 'La unidad `%s` falló el %s (resultado: %s).\n\nÚltimas %s líneas del registro (con secretos ocultos):\n\n```\n%s\n```\n' \
  "$unit" "$(date '+%d/%m/%Y %H:%M %Z')" "${result:-desconocido}" "$LINES" "$journal")"

gh label create "$LABEL" --color B60205 --description "Falla de una ingesta" --force >/dev/null
number="$(gh issue list --state open --label "$LABEL" --search "in:title \"$title\"" \
  --json number,title --jq "map(select(.title == \"$title\")) | first | .number // empty")"
if [[ -n "$number" ]]; then
  gh issue comment "$number" --body "$body"
else
  gh issue create --title "$title" --label "$LABEL" --body "$body"
fi

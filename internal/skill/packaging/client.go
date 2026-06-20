package packaging

import (
	"strings"

	skillmodel "github.com/QuantumNous/new-api/internal/skill/model"
)

// runnerKeyEnvVar is the environment variable the bundled client reads the
// runner's own DeepRouter key from. No key → AUTH_REQUIRED (R2/D-09, DR-81).
const runnerKeyEnvVar = "DEEPROUTER_API_KEY"

// runClientTemplate is the thin routing client shipped in the package. It uses
// only the Python standard library so it runs anywhere with python3 installed.
// Tokens __SKILL_SLUG__ and __API_KEY_ENV__ are substituted at build time
// (template kept fmt-free so Python's own % operators are left untouched).
//
// Moat-critical properties:
//   - The "do the work" step is the POST to DeepRouter's routing API; deleting it
//     leaves the Skill unable to run (no local model selection).
//   - Auth is the runner's OWN key from the environment; the package ships no
//     credentials. Missing key → AUTH_REQUIRED, exit 1.
//   - Input/instruction separation (DR-136): user content travels in the
//     structured `input` object and is NEVER concatenated into an instruction.
//     The client does not send the template — the server uses its authoritative
//     snapshot bound to skill_version_id.
const runClientTemplate = `#!/usr/bin/env python3
"""Thin DeepRouter routing client for the "__SKILL_SLUG__" Skill package.

Usage:
    export __API_KEY_ENV__="<your DeepRouter key>"
    python run.py [input.json]      # or pipe JSON input on stdin

The work step routes through DeepRouter, which selects the best model for the
declared tier and bills your key. Without a key it fails with AUTH_REQUIRED.
"""
import json
import os
import sys
import urllib.error
import urllib.request

API_KEY_ENV = "__API_KEY_ENV__"
DEFAULT_BASE_URL = "https://api.deeprouter.ai"


def die(code, message):
    print(json.dumps({"error": {"code": code, "message": message}}), file=sys.stderr)
    sys.exit(1)


def load_manifest():
    here = os.path.dirname(os.path.abspath(__file__))
    with open(os.path.join(here, "manifest.json"), "r", encoding="utf-8") as f:
        return json.load(f)


def read_input():
    if len(sys.argv) > 1:
        with open(sys.argv[1], "r", encoding="utf-8") as f:
            raw = f.read()
    else:
        raw = sys.stdin.read()
    raw = raw.strip()
    if not raw:
        return {}
    return json.loads(raw)


def main():
    manifest = load_manifest()

    api_key = os.environ.get(API_KEY_ENV, "").strip()
    if not api_key:
        die("AUTH_REQUIRED",
            "No DeepRouter key. Set " + API_KEY_ENV + " to your own key, then "
            "re-run. Sign up at https://deeprouter.ai to get one.")

    base_url = os.environ.get("DEEPROUTER_BASE_URL", DEFAULT_BASE_URL).rstrip("/")
    url = base_url + manifest["routing"]["api_path"]

    # Input/instruction separation: user content stays in a structured object and
    # is never concatenated into an instruction. The server binds execution to
    # skill_version_id and uses its own authoritative template + routing.
    payload = {
        "skill_id": manifest["skill_id"],
        "skill_version_id": manifest["skill_version_id"],
        "input": read_input(),
    }

    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        method="POST",
        headers={
            "Content-Type": "application/json",
            "Authorization": "Bearer " + api_key,
        },
    )
    try:
        with urllib.request.urlopen(req) as resp:
            print(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="replace")
        die("ROUTING_ERROR", "HTTP " + str(e.code) + " from DeepRouter: " + detail)
    except urllib.error.URLError as e:
        die("ROUTING_ERROR", "could not reach DeepRouter: " + str(e.reason))


if __name__ == "__main__":
    main()
`

// renderRunClient produces the package's run.py for a given Skill.
func renderRunClient(skill skillmodel.Skill) string {
	out := strings.ReplaceAll(runClientTemplate, "__SKILL_SLUG__", skill.Slug)
	out = strings.ReplaceAll(out, "__API_KEY_ENV__", runnerKeyEnvVar)
	return out
}

# Upstream lineage

BoxAI Connect is a squashed, vendored derivative of
[CC Switch](https://github.com/farion1231/cc-switch).

- Upstream release: **v3.18.0**
- Requested signed tag object: `0dfc78f520a01b9c17d128cad21ee03cd7f30106`
- Imported commit (the tag's peeled target): `606e7bbe75db7f8285f7a3be006fac22b5d22796`
- Imported: 2026-07-30, by way of OriginGame Kit, another fork of the same
  upstream release. Code inherited from that fork is noted below.

## The import is complete, not selective

The whole upstream application was vendored and still runs. Third-party
providers, BYOK key entry, provider import/export, the local proxy, prompts,
sessions, workspaces, tray, MCP management, skills, usage statistics, OpenClaw
and Hermes all work here exactly as they do upstream, and none of them require
a BoxAI account. Connect is a **superset** of CC Switch.

## Not imported

The upstream `.git` directory, CI/release configuration, funding configuration,
signing identity, and updater service. Upstream sponsor, referral, updater and
product identities are not used, and the upstream sponsor imagery that used to
live under `assets/partners/` was dropped rather than re-served under BoxAI's
name. The upstream About/updater tab was removed rather than left pointing at
upstream infrastructure; Connect uses a BoxAI-owned Tauri updater feed and a
compact update action in General settings instead.

## What BoxAI added on top

Confined to `src-tauri/src/boxai/` and `src/components/boxai/`, plus targeted
edits where the upstream shell had to change (branding strings, the config
directory, and the account entry point in the header):

- BoxAI browser sign-in, carried over the gateway's existing desktop PKCE
  authorization endpoints; the credential is stored as a mode-`0600`
  `~/.boxai-connect/gateway-account.json` (not the OS keyring)
- A built-in provider that points supported clients directly at BoxAI with the
  signed-in user's own account key
- Config directory moved from `~/.cc-switch` to `~/.boxai-connect`, so Connect
  cannot read or corrupt a real CC Switch installation

Partner and promotional strings that upstream ships remain attributed to CC
Switch; BoxAI does not claim them.

The shape of this layer — a loopback PKCE browser sign-in, a single seeded
provider per client, and the reconcile-on-sign-in/sign-out model — was taken
from OriginGame Kit, whose own additions are MIT-licensed. Its platform
services (games, assets, deploys), its MCP seeds and its bundled skills were
not imported, because BoxAI has no counterpart to them.

## Relationship to the rest of this repository

`connect/` is an independent program, not a derivative of new-api. It stays
under the MIT License it inherited from CC Switch. The AGPLv3 §7 additional
terms in the repository-root `NOTICE` govern new-api and its user interface;
they do not attach to this subtree.

Licensing: `LICENSE`, `THIRD_PARTY_NOTICES.md`.

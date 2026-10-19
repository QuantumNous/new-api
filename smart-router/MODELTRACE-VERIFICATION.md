# ModelTrace Distribution Verification

## Fixed Source And Ownership

Task F extends the accepted host compatibility base
`03cb833ff7f819cb0592ee6598b8f258eadfcf1c`, tree
`468a2c0518b5abcd8f859ad3c60075d8e1f87e96`, on
`feat/smart-router-modeltrace-task5-20261014`.
Its entire source delta is eight additions and five modifications. Root
frontend/Dockerfile, host/adaptors/billing, module locks, numerical payloads,
vendor source/provenance and nested checksums remain unchanged.

The recovered source owner owns only this same source scope and serial
source-stage Go/Python checks. Evidence from earlier Task F sessions is absent
and is not current acceptance. Any old stage names, counts or outcomes in prior
copies of this document are historical observations only and must not be used
as fresh evidence for this candidate. No duplicate writer or suite owner is
authorized.

## Recovered Source-Stage Acceptance

The retained source-stage commands run serially without Docker, root NewAPI,
relaykit, external network, real-provider or production actions:

- `go test -json -count=1 -p 2 ./...`
- `go test -race -json -count=1 -p 2 ./...`
- `go vet ./...`
- `go build ./...`
- stdlib `unittest` discovery for every
  `modeltrace_runtime/tests/test_*.py`

Fresh retained Go full/race results each contain 688 passing test events,
21 passing packages and three packages without tests; vet/build exit zero.
Original Python discovery ran 207 methods from the root repository and failed
eight assertions because subprocesses that clear PYTHONPATH could not import
the module from that working directory. Those failed raw bytes remain intact.
A targeted unchanged-code diagnostic passed, followed by one full successor
from the smart-router directory: 207 methods and 5,129 successful actions,
zero failures/errors/skips, exit zero. Only PYTHONPATH/TMPDIR and the launch
working directory changed; the same interpreter and test bytes were used.

Authoritative raw outcomes, hashes, source maps, environment allowlists,
timeout status and direct-child reap receipts are external at
`host-integration/task-f-distribution-recovery-r3/` and
`host-integration/root-task-f-completion-20261019-r1/`. The latter report is
`root-task-f-completion-20261019-r1.md`. This outcome documentation and its
outer checksum are updated after the tests; all executable, image, Compose
and other delivery bytes must match their tested source maps before sealing.
Documentation updates are not described as a newly executed full suite.

The Go integration is designed to build and launch the pinned local
`modeltraced`, use separate real SQLite router and attribution databases, and
exercise controlled operator flow across synthetic OpenAI and Anthropic
protocols. It checks signed numeric submit/get/replay, complete and partial
projection, durable reopen/latest and byte-identical original router state.
The Python tests cover three fixed distinct slots, incomplete/inconclusive
results and one-call interrupted unknown state without replacement or fallback.
These are test contracts, not pass claims. Synthetic behavior cannot establish
real-provider identity.

Tools are local Go 1.26.5 and regular CPython 3.14.7 on macOS/arm64. Go uses
offline dependencies, `GOENV=off`, `GOTELEMETRY=off`, `GOWORK=off`,
`GOTOOLCHAIN=local`, `GOPROXY=off`, `GOSUMDB=off`, `GOMAXPROCS=2` and isolated
evidence-owned caches/temp state. Test-only external overlays change only the
single dated `ownedTestRoot` literal in process/config/CLI/daemon tests and
retain original, replacement and reversal proofs. The unchanged Python
discovery runner overrides only `test_worker.PYTHON_EXECUTABLE` in memory. No
frozen test assertion/source is changed. Local checks do not prove native
Linux unit-suite, root NewAPI build or relaykit acceptance.

## Release Assembly And Limits

`requirements.in` preserves Flask>=3.0,<4, click>=8.1.3,<9, numpy>=1.26,<3.
`requirements.lock` exactly copies the reviewed eight-wheel lock, SHA-256
`6c557de964a32c08ef4b216470f2bb766d3a2f00c63f13f04c775163b771e33a`.
Pins: NumPy 2.5.2, Flask 3.1.2, click 8.5.0, blinker 1.9.0,
itsdangerous 2.2.0, Jinja2 3.1.6, MarkupSafe 3.0.4, Werkzeug 3.1.9.
Both Python image definitions use offline hash-required installation and the
prepared regular CPython 3.14.7/Linux amd64/glibc tuple. Python 3.11, musl,
cp314t and other architectures are not accepted by this evidence.
The worker imports NumPy only.

The independently prepared Linux interpreter SHA-256 is
`3fbc4d6c766a7a5d56c4bcc80d3325181a05f1b64596eb7cf622f0ec056dd546`.
Private Go linker pins also bind unchanged runtime-manifest SHA-256
`d86ea47a18a9c6088e2dad96c6a7761c3551048b128531a2717d036640dd188b`
and vendor-provenance SHA-256
`a05e5ab39f1056a0a0234d5e033d1dc3bc1cc259b90c68df460debec38794714`.
Runtime trust remains exactly four numerical files; the complete 26-payload
vendor closure, license, inert archive and nested checksums are shipped.
No upstream app/enrollment/hooks entrypoint is executed.

Numeric Evidence permits 1..3 unique challenge samples, at most 4,096 numbers
per sample, integer values 1..355 and expected counts 0..4,096. Eligibility
requires at least max(80, ceil(0.55 * expected_count)) numbers. Banks are at
most 16 MiB, with at most 256 models/32 families, fixed 355/74 feature
dimensions, finite bounded parameters and 1/2/3-output calibration.
Closed-set probability distinguishes selected bank labels; it cannot prove
arbitrary provider identity. Partial results stay incomplete/inconclusive.

The same reviewed F0 inventory-provisioner is assembled into router and
engine images. Separate independently owned router/attribution SQLite paths
receive the same public inventory through separate one-shot journals.
Existing paths are read-only reconciliation targets; unknown never retries.
Host credentials/signing and operator provider secrets are separate from
numeric-ingest signing. The workbench uses its existing protected-file-to-FD
bootstrap/main; no new secret interface or launcher is introduced.

Compose profiles are disabled by default, with independent network/state
and literal loopback host ports 18086/18087. UID/GID 65532:65532 preserves
BankStore owner-only modes: publisher bank RW, daemon bank RO, independent
daemon DB/temp RW. Actual mount ownership and protected descriptor behavior
still require root execution. Publish one validated generation before starting
the generation-mode daemon; builtin-file mode is mutually exclusive.

Host support retains types 1/14/60 and newly accepted type 45 Chat only.
Type 45 Responses/Messages and type 58 AdvancedCustom remain excluded, as
does type 14 Responses. Managed registry cannot override adaptor authority.
Permanent route exclusions, health/cooldowns, fingerprints, retries, costs
and host billing/quotas/settlement remain unchanged.

## Separate Root Gates

**BUILD_PENDING:** final actual frontend and Linux project images; interpreter,
worker, daemon, workbench/export, generation UID/RO/persistence/shutdown and
browser checks; three complete serial clean archives from one fixed final
commit; separate root/relaykit checks; fresh independent final SPEC then
different QUALITY; remote-head/readback publication gates and Task G
deployment/one-shot Canary. Source self-review is not independent acceptance.
Prepared dependency-image success does not close these gates. No Docker,
VM, SSH, provider, production, credential or P5 action is part of this handoff.

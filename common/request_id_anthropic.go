package common

import (
	"crypto/sha256"
	"strings"
)

// anthropicIDAlphabet is base62 with the visually ambiguous characters
// I, O and l removed, leaving 59 characters. This matches the alphabet
// reverse-engineered from 30 real api.anthropic.com request-id / message-id
// samples (research §4): no I/O/l ever appears across 30×24 = 720 characters.
const anthropicIDAlphabet = "0123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"

const anthropicIDBase = 59 // len(anthropicIDAlphabet)

// anthropicReqIDTimeWidth is the fixed width (in base59 chars) of the
// time-ordered prefix in a generated request id. 59^7 ≈ 2.0e12 comfortably
// covers Unix-second timestamps far past the year 2100, so a fixed width of 7
// keeps the prefix monotonically increasing (left-padded) and therefore
// lexicographically sortable, mirroring the KSUID-style ordering of real
// Anthropic request ids.
const anthropicReqIDTimeWidth = 7

// anthropicReqIDRandWidth is the number of base59 chars taken from the hash of
// the internal id. 7 (time) + 15 (hash) = 22, which combined with the leading
// "01" format marker yields the 24-character suffix observed on real ids.
const anthropicReqIDRandWidth = 15

// anthropicMsgIDWidth is the number of base59 chars taken from the hash of the
// upstream message id. 2 ("01" marker) + 22 = 24, matching real msg_ ids.
const anthropicMsgIDWidth = 22

// encodeBase59FixedWidth encodes a non-negative integer into base59 using
// anthropicIDAlphabet, left-padded with the zero-digit ('0') to exactly width
// characters. Most-significant digit first, so lexical order == numeric order.
func encodeBase59FixedWidth(n uint64, width int) string {
	buf := make([]byte, width)
	for i := width - 1; i >= 0; i-- {
		buf[i] = anthropicIDAlphabet[n%anthropicIDBase]
		n /= anthropicIDBase
	}
	return string(buf)
}

// hashToBase59 maps a string deterministically to a base59 string of exactly
// width characters by interpreting consecutive bytes of its SHA-256 digest as
// base59 digits. Deterministic: same input always yields the same output.
func hashToBase59(input string, width int) string {
	sum := sha256.Sum256([]byte(input))
	buf := make([]byte, width)
	for i := 0; i < width; i++ {
		buf[i] = anthropicIDAlphabet[sum[i%len(sum)]%anthropicIDBase]
	}
	return string(buf)
}

// EncodeAnthropicRequestID deterministically re-encodes an internal request id
// into an Anthropic-style request id: "req_01" + base59(timestamp, 7) +
// base59(SHA-256(internalID), 15), for a total of "req_" + 24 characters.
//
// The result is:
//   - deterministic — same (internalID, unixSec) always produces the same id,
//     so the server log line "request-id=req_... internal=<internalID>" lets an
//     operator reverse-map a client-facing id back to the internal one;
//   - time-ordered — the fixed-width timestamp prefix sorts lexicographically
//     in chronological order, like real Anthropic request ids (KSUID style);
//   - format-compatible — leading "01" marker and the 59-char I/O/l-free
//     alphabet match the reverse-engineered official format (research §4).
func EncodeAnthropicRequestID(internalID string, unixSec int64) string {
	var ts uint64
	if unixSec > 0 {
		ts = uint64(unixSec)
	}
	var b strings.Builder
	b.WriteString("req_01")
	b.WriteString(encodeBase59FixedWidth(ts, anthropicReqIDTimeWidth))
	b.WriteString(hashToBase59(internalID, anthropicReqIDRandWidth))
	return b.String()
}

// EncodeAnthropicMessageID deterministically re-encodes an upstream message id
// (e.g. OpenRouter "gen-...") into an Anthropic-style message id:
// "msg_01" + base59(SHA-256(upstreamID), 22), total "msg_" + 24 characters.
//
// Real Anthropic message ids are unordered after the "01" marker, so a plain
// hash suffices. Determinism lets the upstream id be reverse-verified from logs.
func EncodeAnthropicMessageID(upstreamID string) string {
	return "msg_01" + hashToBase59(upstreamID, anthropicMsgIDWidth)
}

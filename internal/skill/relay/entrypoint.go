package skillrelay

import (
	"github.com/QuantumNous/new-api/internal/skill/enums"
	"github.com/QuantumNous/new-api/internal/skill/errcodes"
)

// ResolveEffectiveEntryPoint applies the shared direct/distribute entry-point
// precedence rules:
// 1. a valid forced route/request-derived entry point wins;
// 2. otherwise, a request-provided deeprouter.entry_point is validated and used;
// 3. otherwise, an optional default is used when non-empty.
//
// Invalid request-provided values return INVALID_REQUEST. Invalid forced values
// are ignored so callers can fall back to a valid request-provided value or the
// optional default without emitting a fabricated entry_point.
func ResolveEffectiveEntryPoint(forced string, requested string, defaultEntryPoint string) (string, errcodes.ErrorCode) {
	if ep := enums.EntryPoint(forced); ep.Valid() {
		return string(ep), ""
	}
	if requested != "" {
		ep := enums.EntryPoint(requested)
		if !ep.Valid() {
			return "", errcodes.ErrInvalidRequest
		}
		return string(ep), ""
	}
	if ep := enums.EntryPoint(defaultEntryPoint); ep.Valid() {
		return string(ep), ""
	}
	return "", ""
}

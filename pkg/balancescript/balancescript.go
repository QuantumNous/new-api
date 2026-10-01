// Package balancescript compiles and validates opt-in per-channel balance
// query scripts. A balance script is a small synchronous ESM module
// exporting buildBalanceRequest(ctx) and parseBalanceResponse(ctx, response),
// executed through the existing pkg/jsplugin sandbox. This package only
// covers compile-time validation; the host (controller package) owns the
// actual HTTP execution because that requires channel/model state that
// would otherwise create an import cycle with model.
package balancescript

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/pkg/jsplugin"
)

// MaxSourceBytes bounds the balance_script source accepted at save time.
// Balance scripts are tiny (two small hooks); this is generous enough for
// real scripts while keeping compile/storage cost bounded.
const MaxSourceBytes = 32 << 10

// CallTimeout bounds each buildBalanceRequest/parseBalanceResponse call.
const CallTimeout = 5 * time.Second

const (
	HookBuildRequest  = "buildBalanceRequest"
	HookParseResponse = "parseBalanceResponse"
)

// Compile performs save-time validation: the script must compile and export
// both required hooks as callables. Returns a ready-to-use, freshly compiled
// Engine — callers that only need validation should discard it.
func Compile(source string) (*jsplugin.Engine, error) {
	if len(source) > MaxSourceBytes {
		return nil, fmt.Errorf("balance_script exceeds %d bytes", MaxSourceBytes)
	}
	engine, err := jsplugin.Compile(source, jsplugin.Options{
		Key:     "balance_script",
		Version: "1",
		Timeout: CallTimeout,
	})
	if err != nil {
		// The underlying error may echo back script source or a thrown
		// exception's message (e.g. a top-level throw evaluated during
		// compile), so it is never surfaced verbatim.
		return nil, fmt.Errorf("balance_script failed to compile")
	}
	ctx, cancel := context.WithTimeout(context.Background(), CallTimeout)
	defer cancel()
	for _, hook := range []string{HookBuildRequest, HookParseResponse} {
		callable, err := engine.HasCallablePath(ctx, hook)
		if err != nil {
			return nil, fmt.Errorf("balance_script hook %s validation failed", hook)
		}
		if !callable {
			return nil, fmt.Errorf("balance_script must export a callable %s", hook)
		}
	}
	return engine, nil
}

// Validate reports whether source compiles and exports both required hooks.
// An empty source is valid: the feature is opt-in. The raw, untrimmed source
// is checked against MaxSourceBytes first because TrimSpace would otherwise
// let unlimited padding whitespace slip past the size limit.
func Validate(source string) error {
	if len(source) > MaxSourceBytes {
		return fmt.Errorf("balance_script exceeds %d bytes", MaxSourceBytes)
	}
	source = strings.TrimSpace(source)
	if source == "" {
		return nil
	}
	_, err := Compile(source)
	return err
}

package pluginkit

import (
	"context"
	_ "embed"
	"math"
	"slices"
	"sync/atomic"

	"github.com/QuantumNous/new-api/relaykit/dto"
)

// SchemaV1 is the JSON Schema of the API v1 manifest (v1.schema.json).
//
//go:embed v1.schema.json
var SchemaV1 []byte

// TypesV1 is the TypeScript declaration of API v1 (v1.d.ts).
//
//go:embed v1.d.ts
var TypesV1 []byte

// New API channel types a plugin may not declare in meta.channelTypes: a
// type-61 channel binds a plugin by key, and a type-60 New API channel
// extends with plugins through its own setting.
const (
	ChannelTypeNewAPI     = 60
	ChannelTypeTaskPlugin = 61
)

// MaxPluginKeyLength is the longest plugin key, in bytes.
const MaxPluginKeyLength = 30

// newAPIReservedKeys are the keys new-api refuses because /{key} would collide
// with its own paths: api, the first segments of its routes and reserved route
// namespaces, and the route prefixes its built-in plugins own. A root-module
// test derives the set from new-api's routers and checks this list.
var newAPIReservedKeys = []string{
	"401", "403", "404", "500", "503", "about", "ali", "api", "assets", "channels", "chat", "chat2link",
	"console", "dashboard", "errors", "forbidden", "forgot-password", "keys", "login", "mj", "models",
	"oauth", "otp", "pg", "playground", "pricing", "privacy-policy", "profile", "rankings",
	"redemption-codes", "register", "request-processing", "reset", "security", "setup", "sign-in",
	"sign-up", "subscriptions", "suno", "system-info", "system-settings", "task-plugins", "usage-logs",
	"user", "user-agreement", "users", "v1", "v1beta", "wallet",
}

// NewAPIReservedKeys returns, sorted, the plugin keys new-api refuses because
// they collide with its own paths, for another host that warns authors of
// plugins meant for new-api too. Each call returns a new slice.
func NewAPIReservedKeys() []string {
	return slices.Clone(newAPIReservedKeys)
}

// Bounds of the usage facts a plugin reports and of its usage examples:
// second facts at most MaxUsageSeconds, count facts at most MaxUsageCount,
// token and credit facts at most MaxUsageQuota.
const (
	MaxUsageSeconds = 3600
	MaxUsageCount   = dto.MaxImageN
	MaxUsageQuota   = math.MaxInt32
)

// Host is what the gateway running the plugins sets for all of them. A zero
// member keeps the default the API v1 document gives.
type Host struct {
	// MemoryLimit is the memory, in bytes, the JavaScript of one hook call
	// may keep; 0 or less means no limit. Nil keeps 512 MiB. It is read when
	// a runtime is created.
	MemoryLimit func() int64
	// MaxRequestBodyBytes bounds a request a converter builds; 0 or less
	// keeps 128 MiB. It is read on every conversion.
	MaxRequestBodyBytes func() int
	// MaxStreamEventBytes bounds a converter's state and the event data of
	// one call; 0 or less keeps 128 MiB. It is read on every conversion.
	MaxStreamEventBytes func() int
	// ReservedRouteNamespaces are host paths a plugin route may not enter,
	// such as "/v1/tasks". A key may not be the first segment of one.
	ReservedRouteNamespaces []string
	// ReservedKeys are other keys a plugin may not take, such as "api".
	ReservedKeys []string
	// ParamOverride runs utils.paramOverride; nil leaves the utility
	// unavailable on this host.
	ParamOverride ParamOverrideFunc
	// Debug receives the console output of plugins and other debug lines;
	// nil discards them.
	Debug func(ctx context.Context, format string, args ...any)
}

var defaultHost = Host{
	ReservedRouteNamespaces: []string{"/assets", "/v1/tasks"},
	ReservedKeys:            []string{"api"},
}

var currentHost atomic.Pointer[Host]

func init() {
	currentHost.Store(&defaultHost)
}

// Configure sets the host for every plugin. A host calls it at startup,
// before it compiles plugins; the namespaces and keys apply to plugins
// compiled after the call.
func Configure(host Host) {
	currentHost.Store(&host)
}

// SetParamOverrideFunc sets the function utils.paramOverride calls and keeps
// the rest of the host; nil removes it.
func SetParamOverrideFunc(fn ParamOverrideFunc) {
	host := *hostConfig()
	host.ParamOverride = fn
	currentHost.Store(&host)
}

func hostConfig() *Host {
	return currentHost.Load()
}

// callMemoryLimit is the memory, in bytes, the JavaScript of one hook call may
// keep before the runtime stops it; 0 means no limit. When the call's
// allocations reach it, the runtime measures what is still in use, so garbage
// does not count. Each call starts a new budget.
func callMemoryLimit() int64 {
	limit := hostConfig().MemoryLimit
	if limit == nil {
		return 512 << 20
	}
	return max(limit(), 0)
}

func maxConvertedBodyBytes() int {
	if limit := hostConfig().MaxRequestBodyBytes; limit != nil {
		if bytes := limit(); bytes > 0 {
			return bytes
		}
	}
	return 128 << 20
}

func maxConvertedEventBytes() int {
	if limit := hostConfig().MaxStreamEventBytes; limit != nil {
		if bytes := limit(); bytes > 0 {
			return bytes
		}
	}
	return 128 << 20
}

func debugLog(ctx context.Context, format string, args ...any) {
	if debug := hostConfig().Debug; debug != nil {
		debug(ctx, format, args...)
	}
}

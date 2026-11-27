package jsplugin

import (
	"context"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/pluginkit"
)

// reservedRouteNamespaces are host paths a plugin route may never enter:
// console pages, assets and the generic task routes. The other host
// namespaces, such as /api, follow the outer router's static routes and are
// decided at admission.
var reservedRouteNamespaces = []string{
	"/assets",
	"/setup",
	"/v1/tasks",
	"/console",
	"/login",
	"/forbidden",
	"/sign-in",
	"/sign-up",
	"/forgot-password",
	"/oauth",
	"/otp",
	"/register",
	"/reset",
	"/privacy-policy",
	"/user-agreement",
	"/about",
	"/pricing",
	"/rankings",
	"/user",
	"/401",
	"/403",
	"/404",
	"/500",
	"/503",
	"/chat2link",
	"/system-settings",
	"/channels",
	"/chat",
	"/dashboard",
	"/errors",
	"/keys",
	"/models",
	"/playground",
	"/profile",
	"/redemption-codes",
	"/request-processing",
	"/security",
	"/subscriptions",
	"/system-info",
	"/task-plugins",
	"/usage-logs",
	"/users",
	"/wallet",
}

// The settings are read on every use, so values loaded from the environment
// after this runs still apply.
func init() {
	pluginkit.Configure(pluginkit.Host{
		MemoryLimit:             func() int64 { return int64(max(constant.PluginMemoryLimitMB, 0)) << 20 },
		MaxRequestBodyBytes:     func() int { return constant.MaxRequestBodyMB << 20 },
		MaxStreamEventBytes:     func() int { return constant.StreamScannerMaxBufferMB << 20 },
		ReservedRouteNamespaces: reservedRouteNamespaces,
		ReservedKeys:            []string{"api"},
		Debug:                   logger.LogDebug,
	})
}

// ReplayFixture compiles a plugin, admits its routes as the registry does, and
// runs every fixture case in declaration order (pluginkit.ReplayFixture).
func ReplayFixture(ctx context.Context, source string, data []byte) (FixtureReport, error) {
	return pluginkit.ReplayFixtureWith(ctx, NewRegistry().Register, source, data)
}

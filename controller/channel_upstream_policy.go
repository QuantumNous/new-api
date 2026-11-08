package controller

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relaykit/dto"

	"github.com/gin-gonic/gin"
)

// channelUpstreamTarget is one outbound destination of a channel.
type channelUpstreamTarget struct {
	kind string
	url  string
}

// collectChannelUpstreamTargets returns the outbound destinations of a
// channel: the upstream base URL and the channel proxy. Both reach into the
// network of the deployment, so both are covered by the internal network
// policy.
func collectChannelUpstreamTargets(baseURL string, proxy string) []channelUpstreamTarget {
	targets := make([]channelUpstreamTarget, 0, 2)
	if trimmed := strings.TrimSpace(baseURL); trimmed != "" {
		targets = append(targets, channelUpstreamTarget{kind: "base_url", url: trimmed})
	}
	if trimmed := strings.TrimSpace(proxy); trimmed != "" {
		targets = append(targets, channelUpstreamTarget{kind: "proxy", url: trimmed})
	}
	return targets
}

// channelSettingJSON returns the raw channel settings JSON of a request.
func channelSettingJSON(setting *string) string {
	if setting == nil {
		return ""
	}
	return *setting
}

// settingRequestsInternalNetwork reports whether the channel settings of a
// request explicitly ask for the internal network permission. The raw JSON is
// inspected, because the parsed settings cannot tell an explicit request from
// a permission that was carried over from the stored channel.
func settingRequestsInternalNetwork(settingJSON string) bool {
	trimmed := strings.TrimSpace(settingJSON)
	if trimmed == "" {
		return false
	}
	var rawSettings map[string]json.RawMessage
	if err := common.Unmarshal([]byte(trimmed), &rawSettings); err != nil {
		return false
	}
	value, ok := rawSettings["allow_private_network"]
	if !ok {
		return false
	}
	var allowed bool
	if err := common.Unmarshal(value, &allowed); err != nil {
		return false
	}
	return allowed
}

// enforceChannelUpstreamPolicy applies the internal network policy to the
// outbound destinations of a channel.
//
// A channel that reaches into an internal network (RFC 1918, loopback,
// link-local, CGNAT) is reserved for the root account: a compromised
// administrator session must not be able to turn the gateway into a proxy for
// services that are only reachable from the deployment network. The root
// account receives a prominent warning for every internal target.
//
// The returned settings carry the internal network permission of the channel.
// It is granted automatically when the root account points a channel at an
// internal destination and is never granted to a standard administrator. A
// destination that is public again does not keep the permission, unless the
// root account asks for it explicitly.
func enforceChannelUpstreamPolicy(c *gin.Context, baseURL string, proxy string, requested dto.ChannelSettings, explicitlyRequested bool) (dto.ChannelSettings, bool) {
	ctx := context.Background()
	if c.Request != nil {
		ctx = c.Request.Context()
	}

	internalTargets := make([]channelUpstreamTarget, 0, 2)
	for _, target := range collectChannelUpstreamTargets(baseURL, proxy) {
		internal, err := common.URLTargetsPrivateNetwork(ctx, target.url)
		if err != nil {
			// The destination cannot be resolved right now. The dial time
			// validation still protects the connection, so the request is not
			// rejected on a transient DNS failure.
			logger.LogWarn(ctx, common.LogText("cannot resolve the channel %s %q for the internal network policy: %s", target.kind, target.url, err.Error()))
			continue
		}
		if internal {
			internalTargets = append(internalTargets, target)
		}
	}

	isRoot := c.GetInt("role") == common.RoleRootUser
	if len(internalTargets) > 0 && !isRoot {
		targets := make([]string, 0, len(internalTargets))
		for _, target := range internalTargets {
			targets = append(targets, target.url)
		}
		common.ApiErrorStatus(
			c,
			http.StatusForbidden,
			common.NewMessage("Unauthorized, only the root account can use internal network upstreams"),
			gin.H{"targets": targets},
		)
		return requested, false
	}

	if !isRoot {
		if requested.AllowPrivateNetwork {
			logger.LogWarn(ctx, common.LogText("the internal network permission can only be granted by the root account and was removed from the channel settings"))
		}
		requested.AllowPrivateNetwork = false
		return requested, true
	}

	if len(internalTargets) > 0 {
		requested.AllowPrivateNetwork = true
		for _, target := range internalTargets {
			logger.LogWarn(ctx, common.LogText("SECURITY WARNING: the root account pointed a channel at the internal network (%s %s), the gateway forwards traffic to it", target.kind, target.url))
		}
		return requested, true
	}
	if !explicitlyRequested && requested.AllowPrivateNetwork {
		// A public destination does not need the internal network permission,
		// so a permission that was granted for another destination is removed.
		requested.AllowPrivateNetwork = false
	}
	return requested, true
}

// applyChannelUpstreamPolicy enforces the internal network policy for a
// channel and stores the resulting settings on the channel when the internal
// network permission changed.
func applyChannelUpstreamPolicy(c *gin.Context, channel *model.Channel, baseURL string, proxy string, settings dto.ChannelSettings, explicitlyRequested bool) bool {
	effective, ok := enforceChannelUpstreamPolicy(c, baseURL, proxy, settings, explicitlyRequested)
	if !ok {
		return false
	}
	if effective.AllowPrivateNetwork != settings.AllowPrivateNetwork {
		channel.SetSetting(effective)
	}
	return true
}

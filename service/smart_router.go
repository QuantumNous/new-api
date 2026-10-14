package service

import (
	"crypto/rand"
	"encoding/base64"
	"net/http"
	"strings"
	"sync/atomic"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/jsplugin"
	host "github.com/QuantumNous/new-api/pkg/smartrouterhost"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	hosttypes "github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
)

type smartRouterRuntime struct {
	client   *host.Client
	bindings []host.RegistryEntry
	limit    int
	scope    string
}

var smartRouter atomic.Pointer[smartRouterRuntime]

const smartRouterAdmissionFailedKey = "smart_router_host_admission_failed"

// ConfigureSmartRouter installs the optional host runtime.
func ConfigureSmartRouter(lookup func(string) string) error {
	config, err := host.LoadConfig(lookup)
	if err != nil {
		smartRouter.Store(nil)
		return host.ErrConfig
	}
	if !config.Enabled {
		smartRouter.Store(nil)
		return nil
	}
	client, err := host.NewClient(config, nil)
	if err != nil {
		smartRouter.Store(nil)
		return host.ErrConfig
	}
	smartRouter.Store(&smartRouterRuntime{client: client, bindings: config.Bindings, limit: config.AttemptLimit, scope: config.Scope})
	return nil
}

func smartRouterProtocol(c *gin.Context, group string) host.Protocol {
	if c == nil || c.Request == nil || c.Request.Method != http.MethodPost || group == "" || group == "auto" ||
		host.Excluded(c) || RequestPolicy(c).SessionMode == "strict" ||
		common.GetContextKeyBool(c, constant.ContextKeyStreamRecoveryWorker) {
		return ""
	}
	if strings.EqualFold(c.Request.Header.Get("Upgrade"), "websocket") {
		return ""
	}
	for _, filter := range GetChannelConstraints(c).Filters {
		if filter.Kind == dto.FilterTaskPluginIdentity && filter.TaskPluginKey != "" {
			return ""
		}
	}
	if _, exists := c.Get(hosttypes.AppRelaySubjectContextKey); exists {
		return ""
	}
	for _, key := range []string{jsplugin.ContextKeyPinnedPlugin, jsplugin.ContextKeyPinnedEndpoint, jsplugin.ContextKeyPinnedRoute} {
		if _, exists := c.Get(key); exists {
			return ""
		}
	}
	if _, pinned, _ := GetChannelConstraints(c).ResolvedPin(); pinned {
		return ""
	}
	if common.GetContextKeyBool(c, constant.ContextKeyTokenStreamRecovery) &&
		(c.Request.URL.Path == "/v1/responses" || c.Request.URL.Path == "/v1/messages") {
		setting := operation_setting.GetStreamRecoverySetting()
		if setting.Enabled || setting.IdentityMode == operation_setting.StreamRecoveryIdentityModeDraining {
			storage, err := common.GetBodyStorage(c)
			if err != nil {
				return ""
			}
			body, err := storage.Bytes()
			if err != nil {
				return ""
			}
			var probe struct {
				Model  string `json:"model"`
				Stream bool   `json:"stream"`
			}
			if common.Unmarshal(body, &probe) != nil {
				return ""
			}
			modelName := common.GetContextKeyString(c, constant.ContextKeyOriginalModel)
			if modelName == "" {
				modelName = probe.Model
			}
			// Exclude the parent before recovery copies its request context.
			if probe.Stream && operation_setting.IsStreamRecoveryModelAllowed(modelName) {
				return ""
			}
		}
	}
	switch c.Request.URL.Path {
	case "/v1/chat/completions":
		return host.ProtocolChat
	case "/v1/responses":
		return host.ProtocolResponses
	case "/v1/messages":
		return host.ProtocolMessages
	default:
		return ""
	}
}

// smartRouterChannel resolves only current host-authorized cache entries.
func smartRouterChannel(c *gin.Context, entry host.RegistryEntry) (*model.Channel, error) {
	channel, err := model.CacheGetChannel(entry.ChannelID)
	if err != nil || channel == nil || channel.Status != common.ChannelStatusEnabled ||
		!model.IsChannelEnabledForGroupModel(entry.Group, entry.Model, entry.ChannelID) {
		return nil, host.ErrBinding
	}
	if ok, _ := model.ChannelSatisfiesFilters(channel, entry.Model, GetChannelConstraints(c).Filters); !ok {
		return nil, host.ErrBinding
	}
	// This scope uses only the audited common HTTP transport adaptors.
	if channel.Type != constant.ChannelTypeOpenAI && channel.Type != constant.ChannelTypeNewAPI &&
		(channel.Type != constant.ChannelTypeAnthropic || entry.Protocol == string(host.ProtocolResponses)) {
		return nil, host.ErrBinding
	}
	if channel.GetSetting().TaskPluginKey != "" {
		return nil, host.ErrBinding
	}
	return channel, nil
}

// A successful read distinguishes no attached ownership from uncertain ownership.
func smartRouterManagedChannels() (map[int]bool, error) {
	if model.DB == nil {
		return nil, host.ErrBinding
	}
	routes, err := model.ListUpstreamManagedRoutes()
	if err != nil {
		return nil, host.ErrBinding
	}
	attached := make(map[int]bool, len(routes))
	for _, route := range routes {
		if !route.Detached {
			attached[route.ChannelID] = true
		}
	}
	return attached, nil
}

func SelectSmartRouterChannel(param *RetryParam) (*model.Channel, string, bool, error) {
	if param == nil || param.Ctx == nil {
		return nil, "", false, nil
	}
	c := param.Ctx
	state := host.StateFor(c)
	if state == nil {
		if host.Excluded(c) {
			return nil, "", false, nil
		}
		if c.GetBool(smartRouterAdmissionFailedKey) {
			return nil, param.TokenGroup, true, host.ErrBinding
		}
		runtime := smartRouter.Load()
		if runtime == nil {
			return nil, "", false, nil
		}
		protocol := smartRouterProtocol(c, param.TokenGroup)
		if protocol == "" {
			host.Exclude(c)
			return nil, "", false, nil
		}
		matched := make([]host.RegistryEntry, 0, 5)
		for _, entry := range runtime.bindings {
			if entry.Group == param.TokenGroup && entry.Model == param.ModelName && entry.Protocol == string(protocol) {
				matched = append(matched, entry)
			}
		}
		if runtime.scope == "registry" {
			if len(matched) == 0 {
				host.Exclude(c)
				return nil, "", false, nil
			}
			managed, err := smartRouterManagedChannels()
			if err != nil {
				c.Set(smartRouterAdmissionFailedKey, true)
				return nil, param.TokenGroup, true, host.ErrBinding
			}
			if len(managed) != 0 {
				filters := GetChannelConstraints(c).Filters
				priorities, err := model.ListSatisfiedChannelPriorities(param.TokenGroup, param.ModelName, filters)
				if err != nil {
					c.Set(smartRouterAdmissionFailedKey, true)
					return nil, param.TokenGroup, true, host.ErrBinding
				}
				for _, priority := range priorities {
					ids, err := model.ListSatisfiedChannelIDsAtPriority(param.TokenGroup, param.ModelName, priority, filters)
					if err != nil {
						c.Set(smartRouterAdmissionFailedKey, true)
						return nil, param.TokenGroup, true, host.ErrBinding
					}
					for _, id := range ids {
						if managed[id] {
							host.Exclude(c)
							return nil, "", false, nil
						}
					}
				}
			}
		}
		entries := make([]host.RegistryEntry, 0, len(matched))
		bindings := make([]host.Binding, 0, len(matched))
		for _, entry := range matched {
			if _, err := smartRouterChannel(c, entry); err != nil {
				continue
			}
			entries = append(entries, entry)
			bindings = append(bindings, host.Binding{BindingID: entry.BindingID, ProtocolPlugin: entry.ProtocolPlugin, Rank: len(bindings) + 1})
		}
		if len(entries) == 0 {
			c.Set(smartRouterAdmissionFailedKey, true)
			return nil, param.TokenGroup, true, host.ErrBinding
		}
		var id [18]byte
		if _, err := rand.Read(id[:]); err != nil {
			c.Set(smartRouterAdmissionFailedKey, true)
			return nil, param.TokenGroup, true, host.ErrRequest
		}
		request := host.RouteRequest{Kind: "route_request", SchemaVersion: 1,
			RequestID: "sr_" + base64.RawURLEncoding.EncodeToString(id[:]), Group: param.TokenGroup,
			Model: param.ModelName, Protocol: protocol, AttemptLimit: runtime.limit, Bindings: bindings}
		route, err := runtime.client.Route(c.Request.Context(), request)
		if err != nil {
			c.Set(smartRouterAdmissionFailedKey, true)
			return nil, param.TokenGroup, true, err
		}
		state = host.NewState(runtime.client, request, route, entries)
		host.Install(c, state)
	}
	entry, err := state.Current()
	if err != nil {
		return nil, param.TokenGroup, true, err
	}
	if entry.Group != param.TokenGroup || entry.Model != param.ModelName ||
		entry.Protocol != string(smartRouterProtocol(c, param.TokenGroup)) {
		state.LimitAttempts(0)
		return nil, param.TokenGroup, true, host.ErrBinding
	}
	channel, err := smartRouterChannel(c, entry)
	if err != nil {
		state.LimitAttempts(0)
	}
	return channel, entry.Group, true, err
}

func BeginSmartRouterAttempt(c *gin.Context) error {
	state := host.StateFor(c)
	if state == nil {
		return nil
	}
	entry, err := state.Current()
	if err != nil {
		return err
	}
	if err := validateSmartRouterSend(c, entry); err != nil {
		state.LimitAttempts(0)
		return host.ErrBinding
	}
	return state.Begin()
}

// BeforeSmartRouterSend revalidates immediately before the actual Do boundary.
func BeforeSmartRouterSend(c *gin.Context) error {
	state := host.StateFor(c)
	if state == nil {
		return nil
	}
	entry, err := state.Current()
	if err != nil {
		return err
	}
	if err := validateSmartRouterSend(c, entry); err != nil {
		state.LimitAttempts(0)
		return host.ErrBinding
	}
	return state.Invoke()
}

func validateSmartRouterSend(c *gin.Context, entry host.RegistryEntry) error {
	channel, err := smartRouterChannel(c, entry)
	if err != nil || entry.ChannelID != c.GetInt("channel_id") ||
		channel.Type != c.GetInt("channel_type") ||
		entry.Model != common.GetContextKeyString(c, constant.ContextKeyOriginalModel) ||
		entry.Group != common.GetContextKeyString(c, constant.ContextKeyUsingGroup) ||
		entry.Protocol != string(smartRouterProtocol(c, entry.Group)) {
		return host.ErrBinding
	}
	managed, err := smartRouterManagedChannels()
	if err != nil || managed[entry.ChannelID] {
		return host.ErrBinding
	}
	return nil
}

func FinishSmartRouterAttempt(c *gin.Context, info *relaycommon.RelayInfo, upstreamError *types.NewAPIError) bool {
	state := host.StateFor(c)
	if state == nil {
		return true
	}
	requireProtocol, protocolCompleted := state.ProtocolOutcome()
	completed := upstreamError == nil
	if info.IsStream {
		outcome := info.StreamStatus.OutcomeSnapshot()
		completed = completed && info.StreamStatus != nil && info.StreamStatus.IsNormalEnd() &&
			!outcome.HasErrors
		if !requireProtocol {
			completed = completed && outcome.Response == relaycommon.ResponseOutcomeCompleted
		}
	}
	if requireProtocol {
		completed = completed && protocolCompleted
	}
	return state.Finish(c.Request.Context(), completed, c.Writer.Written())
}

func WaitSmartRouterRetry(c *gin.Context) error {
	if state := host.StateFor(c); state != nil {
		return state.WaitRetry(c.Request.Context(), nil)
	}
	return nil
}

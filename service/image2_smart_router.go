package service

import (
	"fmt"
	"sort"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
)

// Image2RequestCapability is the normalized, auditable request shape used for
// routing. It intentionally contains no provider or production channel ID.
type Image2RequestCapability struct {
	Operation  string
	Resolution string
	Quality    string
	N          uint
}

type Image2CandidateDecision struct {
	ChannelID int
	Selected  bool
	Reason    string
}

// Image2SmartRouter owns one ordered attempt chain for a request. Next marks
// a channel used before returning it, enforcing one attempt per channel.
type Image2SmartRouter struct {
	request    Image2RequestCapability
	candidates []image2Candidate
	next       int
	decisions  []Image2CandidateDecision
}

type image2Candidate struct {
	channel    *model.Channel
	capability *dto.Image2ChannelCapability
}

func Image2SmartRoutingEnabled() bool { return common.Image2SmartRoutingEnabled }

func IsImage2SmartRoute(info *relaycommon.RelayInfo) bool {
	return info != nil && strings.EqualFold(strings.TrimSpace(info.OriginModelName), "gpt-image-2") &&
		(info.RelayMode == relayconstant.RelayModeImagesGenerations || info.RelayMode == relayconstant.RelayModeImagesEdits)
}

func ParseImage2RequestCapability(info *relaycommon.RelayInfo, request *dto.ImageRequest) (Image2RequestCapability, error) {
	if !IsImage2SmartRoute(info) || request == nil {
		return Image2RequestCapability{}, fmt.Errorf("not an Image2 image request")
	}
	operation := "generations"
	if info.RelayMode == relayconstant.RelayModeImagesEdits {
		operation = "edits"
	}
	resolution, err := image2Resolution(request.Size)
	if err != nil {
		return Image2RequestCapability{}, err
	}
	n := uint(1)
	if request.N != nil {
		n = *request.N
	}
	return Image2RequestCapability{Operation: operation, Resolution: resolution, Quality: strings.ToLower(strings.TrimSpace(request.Quality)), N: n}, nil
}

func image2Resolution(size string) (string, error) {
	size = strings.ToLower(strings.TrimSpace(size))
	// OpenAI permits "auto". The first routing version deliberately maps it to
	// the same conservative default tier as an omitted size.
	if size == "" || size == "auto" || size == "1024" || size == "1024x1024" {
		return "1024", nil
	}
	if size == "2048" || size == "2048x2048" {
		return "2048", nil
	}
	if size == "uhd" || size == "4096" || size == "4096x4096" {
		return "uhd", nil
	}
	parts := strings.Split(size, "x")
	if len(parts) != 2 {
		return "", fmt.Errorf("unsupported Image2 size %q", size)
	}
	w, wErr := strconv.Atoi(parts[0])
	h, hErr := strconv.Atoi(parts[1])
	if wErr != nil || hErr != nil || w < 1 || h < 1 {
		return "", fmt.Errorf("invalid Image2 size %q", size)
	}
	if w <= 1024 && h <= 1024 {
		return "1024", nil
	}
	if w <= 2048 && h <= 2048 {
		return "2048", nil
	}
	return "uhd", nil
}

// NewImage2SmartRouter filters every model-bound candidate before selecting.
// Capability metadata is opt-in, therefore an unconfigured channel is safely
// excluded rather than guessed to support a request.
func NewImage2SmartRouter(c *gin.Context, info *relaycommon.RelayInfo, request *dto.ImageRequest) (*Image2SmartRouter, error) {
	if !Image2SmartRoutingEnabled() || !IsImage2SmartRoute(info) {
		return nil, nil
	}
	if _, pinned := c.Get("specific_channel_id"); pinned {
		// An administrator-selected channel is an explicit routing contract.
		// Keep the established selector so the first attempt uses that channel
		// and the existing retry guard prevents any automatic channel switch.
		logger.LogInfo(c, "image2 smart routing bypassed for a specifically selected channel")
		return nil, nil
	}
	req, err := ParseImage2RequestCapability(info, request)
	if err != nil {
		return nil, err
	}
	group := common.GetContextKeyString(c, constant.ContextKeyAutoGroup)
	if group == "" {
		group = info.UsingGroup
	}
	if group == "" || group == "auto" {
		group = info.TokenGroup
	}
	if group == "" || group == "auto" {
		return nil, fmt.Errorf("Image2 smart routing requires a resolved channel group")
	}

	channels, err := model.GetSatisfiedChannels(group, info.OriginModelName)
	if err != nil {
		return nil, err
	}
	router, configured := newImage2SmartRouterIfConfigured(req, channels)
	if !configured {
		// A switch-only rollout must not turn a missing capability migration
		// into a complete outage. Fall back only when no channel has opted in;
		// once any capability is configured, incompatibility remains fail-closed.
		logger.LogWarn(c, fmt.Sprintf(
			"image2 smart routing has no configured capability in group %s; using legacy routing",
			group,
		))
		return nil, nil
	}
	logger.LogInfo(c, fmt.Sprintf("image2 smart routing: request=%s/%s quality=%q n=%d group=%s candidates=%s", req.Operation, req.Resolution, req.Quality, req.N, group, router.DecisionSummary()))
	return router, nil
}

func newImage2SmartRouterIfConfigured(req Image2RequestCapability, channels []*model.Channel) (*Image2SmartRouter, bool) {
	router, configured := buildImage2SmartRouter(req, channels)
	if !configured {
		return nil, false
	}
	return router, true
}

func newImage2SmartRouter(req Image2RequestCapability, channels []*model.Channel) *Image2SmartRouter {
	router, _ := buildImage2SmartRouter(req, channels)
	return router
}

func buildImage2SmartRouter(req Image2RequestCapability, channels []*model.Channel) (*Image2SmartRouter, bool) {
	router := &Image2SmartRouter{request: req, decisions: make([]Image2CandidateDecision, 0, len(channels))}
	configured := false
	seenChannelIDs := make(map[int]struct{}, len(channels))
	for _, channel := range channels {
		if channel == nil {
			continue
		}
		if _, duplicate := seenChannelIDs[channel.Id]; duplicate {
			continue
		}
		seenChannelIDs[channel.Id] = struct{}{}
		setting, err := channel.ParseSetting()
		if err != nil {
			// A malformed setting is an explicit invalid-configuration signal. Treat
			// it as configured for fallback purposes so a corrupted Image2 opt-in
			// cannot silently re-enter the legacy router.
			configured = true
			router.decisions = append(router.decisions, Image2CandidateDecision{ChannelID: channel.Id, Reason: "image2_capability_invalid"})
			continue
		}
		capability := setting.Image2Capability
		if capability != nil && capability.Enabled {
			configured = true
		}
		if reason := image2Incompatibility(req, capability); reason != "" {
			router.decisions = append(router.decisions, Image2CandidateDecision{ChannelID: channel.Id, Reason: reason})
			continue
		}
		router.candidates = append(router.candidates, image2Candidate{channel: channel, capability: capability})
	}
	sort.SliceStable(router.candidates, func(i, j int) bool {
		left, right := router.candidates[i].capability, router.candidates[j].capability
		if left.RoutePriority != right.RoutePriority {
			return left.RoutePriority < right.RoutePriority
		}
		return router.candidates[i].channel.Id < router.candidates[j].channel.Id
	})
	for _, candidate := range router.candidates {
		router.decisions = append(router.decisions, Image2CandidateDecision{ChannelID: candidate.channel.Id, Reason: "compatible"})
	}
	return router, configured
}

// EvaluateImage2SafeFailover applies the Image2 replay allowlist on top of the
// shared stage guards. The shared evaluator still owns response-started,
// acceptance, cancellation, content-safety, and attempt-limit checks; Image2
// then permits only failures that prove the current attempt can be replayed on
// another capability-compatible channel. A late 5xx or transport failure at
// the image guard is blocked unless explicit non-acceptance evidence exists.
func EvaluateImage2SafeFailover(input SafeFailoverInput) SafeFailoverDecision {
	decision := EvaluateSafeFailover(input)
	if !decision.Retry {
		return decision
	}

	// The shared evaluator is responsible for the request lifecycle guards
	// (response started, acceptance evidence, cancellation and attempt cap).
	// Once those guards allow a retry, classify the failure explicitly for the
	// Image2 replay policy. In particular, an HTTP 401/403/404 is not the same
	// class as a channel-local error, while a 5xx and a transport failure need
	// the late-generation guard below.
	switch failureClass := classifyImage2Failure(input.Error); failureClass {
	case image2FailureDeterministic4xx:
		return SafeFailoverDecision{Reason: "image2_deterministic_4xx"}
	case image2FailureServer5xx, image2FailureTransport:
		if input.ImageGuard > 0 && input.AttemptElapsed >= input.ImageGuard &&
			!hasNonAcceptanceEvidence(strings.ToLower(input.Error.Error())) {
			return SafeFailoverDecision{Reason: "image2_replay_guard_elapsed"}
		}
		return decision
	case image2FailureCapacity, image2FailureChannelLocal:
		return decision
	default:
		return SafeFailoverDecision{Reason: "image2_replay_not_allowed_" + decision.Reason}
	}
}

// image2FailureClass is intentionally narrower than the shared retry reasons.
// It prevents a provider's HTTP status from being confused with an internal
// channel error and makes the late-generation replay rule auditable.
type image2FailureClass string

const (
	image2FailureDeterministic4xx image2FailureClass = "deterministic_4xx"
	image2FailureCapacity         image2FailureClass = "capacity"
	image2FailureServer5xx        image2FailureClass = "server_5xx"
	image2FailureTransport        image2FailureClass = "transport"
	image2FailureChannelLocal     image2FailureClass = "channel_local"
	image2FailureOther            image2FailureClass = "other"
)

func classifyImage2Failure(err *types.NewAPIError) image2FailureClass {
	if err == nil {
		return image2FailureOther
	}
	if types.IsChannelError(err) {
		return image2FailureChannelLocal
	}
	statusCode := err.StatusCode
	if statusCode == 429 {
		return image2FailureCapacity
	}
	if statusCode >= 400 && statusCode < 500 {
		return image2FailureDeterministic4xx
	}
	if err.GetErrorCode() == types.ErrorCodeDoRequestFailed || statusCode < 100 || statusCode > 599 {
		return image2FailureTransport
	}
	if statusCode >= 500 {
		return image2FailureServer5xx
	}
	return image2FailureOther
}

func image2Incompatibility(req Image2RequestCapability, capability *dto.Image2ChannelCapability) string {
	if capability == nil || !capability.Enabled {
		return "image2_capability_not_enabled"
	}
	if !containsFold(capability.Operations, req.Operation) {
		return "operation_unsupported"
	}
	if req.Operation == "edits" && !capability.EditsAccepted {
		return "edits_not_accepted"
	}
	if !containsFold(capability.Resolutions, req.Resolution) {
		return "resolution_unsupported"
	}
	// An omitted quality means "use the provider default". Only reject a
	// channel when the client explicitly requests a quality it cannot serve.
	if req.Quality != "" && len(capability.Qualities) > 0 && !containsFold(capability.Qualities, req.Quality) {
		return "quality_unsupported"
	}
	if capability.MaxN > 0 && req.N > capability.MaxN {
		return "n_exceeds_limit"
	}
	return ""
}

func containsFold(values []string, value string) bool {
	for _, candidate := range values {
		if strings.EqualFold(strings.TrimSpace(candidate), value) {
			return true
		}
	}
	return false
}

func (r *Image2SmartRouter) Next() (*model.Channel, *types.NewAPIError) {
	if r == nil || r.next >= len(r.candidates) {
		return nil, types.NewError(fmt.Errorf("no compatible Image2 channel remains"), types.ErrorCodeGetChannelFailed, types.ErrOptionWithSkipRetry())
	}
	channel := r.candidates[r.next].channel
	r.next++
	for i := range r.decisions {
		if r.decisions[i].ChannelID == channel.Id {
			r.decisions[i].Selected = true
			r.decisions[i].Reason = "selected"
			break
		}
	}
	return channel, nil
}

func (r *Image2SmartRouter) DecisionSummary() string {
	if r == nil {
		return ""
	}
	parts := make([]string, 0, len(r.decisions))
	for _, decision := range r.decisions {
		parts = append(parts, fmt.Sprintf("%d:%s", decision.ChannelID, decision.Reason))
	}
	return strings.Join(parts, ",")
}

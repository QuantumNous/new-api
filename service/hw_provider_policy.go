package service

import (
	"errors"
	"math"
	"net/http"
	"net/url"
	"slices"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/types"

	"github.com/gin-gonic/gin"
)

// Supplier routing. Customer traffic is served by approved free routes first,
// then by the Lumia supplier; the alternative suppliers (Portix, Kie, then
// OpenRouter as the very last) are reachable only for the paying group and come
// after Lumia. The policy is
// intentionally a separate state machine: the existing relay loop and channel
// selection keep their behaviour and only ask this file who goes next.
const (
	// HwProviderLumia is the tag of the primary supplier channel.
	HwProviderLumia = "lumia"
	// HwProviderFree is the tag of a free supplier channel. It is tried before
	// Lumia, but only when HwFreeRouteKey approves it for customer data.
	HwProviderFree = "free"
	// HwProviderOpenRouter is the tag of the emergency supplier channel.
	HwProviderOpenRouter = "openrouter"
	// HwProviderPortix is the tag of the Portix reseller channel. Like the
	// emergency supplier it is an alternative route for the paying group only.
	HwProviderPortix = "portix"
	// HwProviderKie is the tag of the Kie reseller channel (paying group only).
	HwProviderKie = "kie"
	// HwProviderInternal marks channels without a supplier tag. They are not
	// part of supplier routing and are never chosen or blocked by this policy.
	HwProviderInternal = "internal"
	// HwPaidGroup is the only group allowed to reach the alternative suppliers.
	HwPaidGroup = "paid"
	// HwChannelCostKey is the other_info key that holds the supplier cost per
	// model of a channel: {"<model>": {"in": <USD per 1M>, "out": <USD per 1M>}}.
	// The model is the upstream name after the channel's model mapping, or the
	// customer model name when the channel does not rename it.
	HwChannelCostKey = "hw_cost_per_m"

	// HwFreeRouteKey is the other_info key that approves a free channel for
	// customer traffic: {"approved": true, "data_class": "K", "region": "eu"}.
	// Free tiers that may store or train on prompts (data class I) or that run
	// in China never carry customer data, so anything else keeps the channel
	// out of the route.
	HwFreeRouteKey = "hw_free_route"

	hwRouteContextKey = "hw_provider_route"
	hwMaxUpstreamIDs  = 5
)

// HwRouteState is the per-request supplier route. It lives in the gin context.
// Selection, retry and logging run on the request goroutine; the response mask
// additionally appends facts (stream markers, upstream ids, mask alerts) from
// the stream writer goroutines of relay/helper's stream scanner. Those writers
// run under the scanner's writeMutex and join the request goroutine through
// its wg.Wait before the log is written, so access stays race-free without
// this state carrying a lock of its own.
type HwRouteState struct {
	active     bool
	group      string
	userGroup  string
	model      string
	family     string
	free       []*model.Channel
	lumia      []*model.Channel
	alternates []*model.Channel
	tried      map[int]bool

	outage       bool
	lumiaRetried bool
	// credit marks a Lumia attempt that failed on the supplier's own credit;
	// creditRetried that its single same-channel retry is spent.
	credit        bool
	creditRetried bool
	// probe is the lease of the Lumia probe slot this request took, zero while
	// it holds none. HwReleaseLumiaProbe frees exactly that lease.
	probe           time.Time
	lastChannel     *model.Channel
	finished        bool
	blockedByFamily int
	attempts        int
	provider        string
	channelID       int
	fallback        bool
	streamWrites    int
	streamCut       bool
	abandonedPrompt int
	maskAlerts      int
	upstreamIDs     []string
}

// HwChannelProvider maps a channel onto its supplier role. The tag is the
// primary signal, but an alternative supplier must also be recognised without an
// exact tag: a channel of the OpenRouter type, a tag that merely prefixes the
// supplier name (openrouter-eu) and a base URL that points at the supplier host
// all count. Missing one of those would let a free account reach an alternative
// supplier, so the check is deliberately broad.
func HwChannelProvider(channel *model.Channel) string {
	if channel == nil {
		return ""
	}
	tag := strings.ToLower(strings.TrimSpace(channel.GetTag()))
	if tag == HwProviderLumia {
		return HwProviderLumia
	}
	if tag == HwProviderFree || strings.HasPrefix(tag, HwProviderFree+"-") {
		return HwProviderFree
	}
	for _, provider := range hwAlternateProviders {
		if tag == provider || strings.HasPrefix(tag, provider+"-") {
			return provider
		}
	}
	if channel.Type == constant.ChannelTypeOpenRouter {
		return HwProviderOpenRouter
	}
	baseURL := channel.GetBaseURL()
	for _, provider := range hwAlternateProviders {
		if hwChannelHostsProvider(baseURL, provider) {
			return provider
		}
	}
	return HwProviderInternal
}

// hwAlternateProviders are the suppliers that come after Lumia. All of them are
// reachable for the paying group only.
var hwAlternateProviders = []string{HwProviderOpenRouter, HwProviderPortix, HwProviderKie}

// hwProviderDomains maps an alternative supplier onto the domains whose hosts
// (and subdomains) count as that supplier.
var hwProviderDomains = map[string][]string{
	HwProviderOpenRouter: {"openrouter.ai"},
	HwProviderPortix:     {"portixapi.com"},
	HwProviderKie:        {"kie.ai"},
}

// hwChannelHostsProvider reports whether a channel base URL points at the host
// of an alternative supplier.
func hwChannelHostsProvider(baseURL, provider string) bool {
	trimmed := strings.TrimSpace(baseURL)
	if trimmed == "" {
		return false
	}
	parsed, err := url.Parse(trimmed)
	if err != nil {
		return false
	}
	host := strings.ToLower(parsed.Hostname())
	for _, domain := range hwProviderDomains[provider] {
		if host == domain || strings.HasSuffix(host, "."+domain) {
			return true
		}
	}
	return false
}

// hwIsAlternateProvider reports whether provider is a supplier behind Lumia.
func hwIsAlternateProvider(provider string) bool {
	return provider == HwProviderOpenRouter || provider == HwProviderPortix || provider == HwProviderKie
}

// HwFreeRouteApproved reports whether a free channel may carry customer data:
// approved by the quality check, data class K and a known region outside China.
func HwFreeRouteApproved(channel *model.Channel) bool {
	if channel == nil {
		return false
	}
	route, ok := channel.GetOtherInfo()[HwFreeRouteKey].(map[string]any)
	if !ok {
		return false
	}
	approved, _ := route["approved"].(bool)
	dataClass, _ := route["data_class"].(string)
	region, _ := route["region"].(string)
	region = strings.ToLower(strings.TrimSpace(region))
	return approved && strings.EqualFold(strings.TrimSpace(dataClass), "K") && region != "" && !hwChineseRegions[region]
}

// hwChineseRegions are the region spellings that count as a Chinese step.
var hwChineseRegions = map[string]bool{"cn": true, "china": true, "hk": true, "hong kong": true, "hongkong": true, "mo": true, "macau": true}

// hwProviderTier orders the suppliers: free, Lumia, then the alternatives.
func hwProviderTier(provider string) int {
	switch {
	case provider == HwProviderFree:
		return 0
	case provider == HwProviderLumia:
		return 1
	case hwIsAlternateProvider(provider):
		return 2
	}
	return -1
}

// hwChannelCost returns the supplier cost of serving customerModel on channel:
// input plus output price per 1M tokens in USD. A channel without cost metadata
// for the model returns +Inf, so it sorts behind every channel with a known
// price instead of being preferred on a guess.
func hwChannelCost(channel *model.Channel, customerModel string) float64 {
	if channel == nil {
		return math.Inf(1)
	}
	costs, ok := channel.GetOtherInfo()[HwChannelCostKey].(map[string]any)
	if !ok {
		return math.Inf(1)
	}
	names := []string{customerModel}
	if mappingJSON := channel.GetModelMapping(); mappingJSON != "" && mappingJSON != "{}" {
		mapping := make(map[string]string)
		if err := common.UnmarshalJsonStr(mappingJSON, &mapping); err == nil {
			if mapped := strings.TrimSpace(mapping[customerModel]); mapped != "" {
				names = []string{mapped, customerModel}
			}
		}
	}
	for _, name := range names {
		entry, ok := costs[name].(map[string]any)
		if !ok {
			continue
		}
		input, inOK := entry["in"].(float64)
		output, outOK := entry["out"].(float64)
		if !inOK || !outOK || input < 0 || output < 0 || math.IsNaN(input) || math.IsNaN(output) {
			continue
		}
		return input + output
	}
	return math.Inf(1)
}

// HwChannelAllowedForGroup enforces the hard rule that the alternative suppliers
// (OpenRouter, Portix, Kie) are only reachable for the paying group. Both the group the token uses and the
// group of the account must be paying: a free account whose token stands on the
// paid group must not reach an alternative supplier either. It is checked while
// building the route and again whenever a channel is picked, so a wrongly
// tagged channel in a free group can never be used even if the route was built
// from stale data.
func HwChannelAllowedForGroup(channel *model.Channel, usingGroup, userGroup string) bool {
	if !hwIsAlternateProvider(HwChannelProvider(channel)) {
		return true
	}
	return usingGroup == HwPaidGroup && userGroup == HwPaidGroup
}

// hwChannelServesFamily reports whether channel serves customerModel inside the
// same model family. The channel's own model mapping decides which upstream
// model the customer name becomes on that channel.
func hwChannelServesFamily(channel *model.Channel, customerModel, family string) bool {
	if channel == nil || family == "" {
		return false
	}
	upstreamModel := customerModel
	if mappingJSON := channel.GetModelMapping(); mappingJSON != "" && mappingJSON != "{}" {
		mapping := make(map[string]string)
		if err := common.UnmarshalJsonStr(mappingJSON, &mapping); err == nil {
			if mapped, ok := mapping[customerModel]; ok && strings.TrimSpace(mapped) != "" {
				upstreamModel = mapped
			}
		}
	}
	return HwModelFamily(upstreamModel) == family
}

// HwRoute returns the supplier route of this request, or nil when supplier
// routing does not apply to it.
func HwRoute(c *gin.Context) *HwRouteState {
	if c == nil {
		return nil
	}
	value, ok := c.Get(hwRouteContextKey)
	if !ok {
		return nil
	}
	state, _ := value.(*HwRouteState)
	if state == nil || !state.active {
		return nil
	}
	return state
}

// HwCustomerModel returns the model name the customer asked for.
func HwCustomerModel(c *gin.Context) string {
	if c == nil {
		return ""
	}
	if state := HwRoute(c); state != nil && state.model != "" {
		return state.model
	}
	return c.GetString("original_model")
}

// hwStartRoute builds the route once. It returns nil when the group+model has no
// supplier-tagged channel at all, so every deployment without supplier tags
// keeps the stock selection untouched.
func hwStartRoute(c *gin.Context, group, modelName string, filters []dto.ChannelFilter) *HwRouteState {
	if c == nil || modelName == "" {
		return nil
	}
	if group == "" {
		group = common.GetContextKeyString(c, constant.ContextKeyUsingGroup)
	}
	userGroup := common.GetContextKeyString(c, constant.ContextKeyUserGroup)
	if group == "" {
		group = userGroup
	}
	if group == HwPaidGroup && c.GetInt("role") >= common.RoleAdminUser {
		// The operator keeps the default account group (HwPromoteToPaidGroup
		// leaves admins alone) but must be able to test the paid route.
		userGroup = HwPaidGroup
	}

	candidates := model.HwChannelsForGroupModel(group, modelName)
	if len(candidates) == 0 {
		return nil
	}
	tagged := 0
	for _, channel := range candidates {
		if HwChannelProvider(channel) != HwProviderInternal {
			tagged++
		}
	}
	if tagged == 0 {
		return nil
	}

	state := &HwRouteState{
		active:    true,
		group:     group,
		userGroup: userGroup,
		model:     modelName,
		family:    HwModelFamily(modelName),
		tried:     make(map[int]bool, len(candidates)),
	}
	for _, channel := range candidates {
		provider := HwChannelProvider(channel)
		if provider == HwProviderInternal {
			continue
		}
		if !HwChannelAllowedForGroup(channel, group, userGroup) {
			// Wrongly tagged alternative channel in a non-paying group: filtered
			// out here and again at pick time.
			continue
		}
		if !hwChannelServesFamily(channel, modelName, state.family) {
			state.blockedByFamily++
			continue
		}
		if ok, _ := model.ChannelSatisfiesFilters(channel, modelName, filters); !ok {
			continue
		}
		switch {
		case provider == HwProviderFree:
			if HwFreeRouteApproved(channel) {
				state.free = append(state.free, channel)
			}
		case hwIsAlternateProvider(provider):
			state.alternates = append(state.alternates, channel)
		default:
			state.lumia = append(state.lumia, channel)
		}
	}
	hwSortAlternates(state.alternates, modelName)
	c.Set(hwRouteContextKey, state)
	return state
}

// hwSortAlternates puts the alternative suppliers in route order: OpenRouter
// always last, whatever it costs; among the others the cheapest for this model
// goes first. The stable sort keeps the priority and id order of the
// candidates for equal or unknown prices.
func hwSortAlternates(alternates []*model.Channel, customerModel string) {
	sort.SliceStable(alternates, func(i, j int) bool {
		lastI := HwChannelProvider(alternates[i]) == HwProviderOpenRouter
		lastJ := HwChannelProvider(alternates[j]) == HwProviderOpenRouter
		if lastI != lastJ {
			return lastJ
		}
		return hwChannelCost(alternates[i], customerModel) < hwChannelCost(alternates[j], customerModel)
	})
}

// claim marks channel as this attempt's channel when it belongs to the route.
// It reports false when the route has to pick a channel itself, which happens
// when the stock selection landed on an untagged or foreign-family channel, or
// on a later supplier while an earlier one (free before Lumia before the
// alternatives) is still untried.
func (s *HwRouteState) claim(channel *model.Channel) bool {
	if s == nil || channel == nil {
		return false
	}
	provider := HwChannelProvider(channel)
	tier := hwProviderTier(provider)
	if tier < 0 {
		return false
	}
	if provider == HwProviderFree && !HwFreeRouteApproved(channel) {
		return false
	}
	if tier > 0 && s.peekFree() != nil {
		return false
	}
	if tier > 1 && s.peekLumia() != nil {
		return false
	}
	// OpenRouter stays last even when the stock selection lands on it first.
	if provider == HwProviderOpenRouter {
		if next := s.peekAlternate(); next != nil && HwChannelProvider(next) != HwProviderOpenRouter {
			return false
		}
	}
	if !HwChannelAllowedForGroup(channel, s.group, s.userGroup) {
		return false
	}
	if !hwChannelServesFamily(channel, s.model, s.family) {
		return false
	}
	// The last check takes the probe slot of a half-open Lumia breaker.
	if provider == HwProviderLumia && !s.takeLumia() {
		return false
	}
	s.tried[channel.Id] = true
	s.recordAttempt(channel, provider)
	return true
}

// recordAttempt updates the facts the admin log and audit trail report.
func (s *HwRouteState) recordAttempt(channel *model.Channel, provider string) {
	s.attempts++
	if s.attempts > 1 {
		s.fallback = true
	}
	s.provider = provider
	s.channelID = channel.Id
	s.lastChannel = channel
}

// hasNext reports whether another upstream attempt remains without consuming it.
func (s *HwRouteState) hasNext() bool {
	if s == nil || !s.active || s.finished {
		return false
	}
	if s.streamCut {
		// The customer already received data; switching supplier now would
		// splice two different answers together.
		return false
	}
	if s.creditRetryPending() || s.peekFree() != nil || s.peekLumia() != nil {
		return true
	}
	if s.outageRetryPending() {
		return true
	}
	return s.peekAlternate() != nil
}

// outageRetryPending reports whether the single extra Lumia attempt after an
// outage still remains. next is the only consumer that can deliver it, so
// hasNext asks the same question: a route whose last attempt failed on another
// supplier has no retry left and must end with that attempt's own error. The
// Lumia breaker replaces the paused retry; it stays only with the breaker off.
func (s *HwRouteState) outageRetryPending() bool {
	if !s.outage || s.lumiaRetried || s.lastChannel == nil || HwChannelProvider(s.lastChannel) != HwProviderLumia {
		return false
	}
	return common.HwLumiaCooldownMs <= 0
}

// creditRetryPending reports whether the single same-channel retry after a
// Lumia credit failure remains. The failure is intermittent, so one more try on
// the same account often succeeds where the next channel would not exist.
func (s *HwRouteState) creditRetryPending() bool {
	return s.credit && !s.creditRetried && s.lastChannel != nil && HwChannelProvider(s.lastChannel) == HwProviderLumia
}

// hwSupplierCreditPause is the pause before the credit retry; tests set it to 0.
var hwSupplierCreditPause = 1500 * time.Millisecond

func (s *HwRouteState) peekFree() *model.Channel {
	for _, channel := range s.free {
		if !s.tried[channel.Id] && HwFreeRouteApproved(channel) {
			return channel
		}
	}
	return nil
}

// peekLumia returns the next untried Lumia channel, or nil while the Lumia
// breaker holds the account back. It does not take the probe slot of a
// half-open breaker; the caller does that when it spends the attempt.
func (s *HwRouteState) peekLumia() *model.Channel {
	if allowed, _ := hwLumiaAllows(false); !allowed {
		return nil
	}
	for _, channel := range s.lumia {
		if !s.tried[channel.Id] && HwChannelAllowedForGroup(channel, s.group, s.userGroup) {
			return channel
		}
	}
	return nil
}

func (s *HwRouteState) peekAlternate() *model.Channel {
	for _, channel := range s.alternates {
		if !s.tried[channel.Id] && HwChannelAllowedForGroup(channel, s.group, s.userGroup) {
			return channel
		}
	}
	return nil
}

// next returns the next channel to try, or nil when the route is exhausted.
//
// Order: every approved free channel of the requested family once (a 429 or
// quota error there moves on at once, without the Lumia pause), then every
// Lumia alias once, then exactly one extra Lumia attempt after a Lumia outage
// (after the fixed pause), then the alternative suppliers for the paying group,
// Portix and Kie cheapest first and OpenRouter last, then nothing at all.
// While the Lumia breaker is open, or its single probe is in flight, Lumia and
// the extra attempt are skipped: a paying request goes straight to an
// alternative supplier and a free one ends with its busy answer. Another family
// is never part of the route.
func (s *HwRouteState) next() *model.Channel {
	if s == nil || s.finished {
		return nil
	}
	if s.creditRetryPending() {
		s.creditRetried = true
		s.credit = false
		time.Sleep(hwSupplierCreditPause)
		s.recordAttempt(s.lastChannel, HwProviderLumia)
		return s.lastChannel
	}
	s.credit = false
	if channel := s.peekFree(); channel != nil {
		s.tried[channel.Id] = true
		s.recordAttempt(channel, HwProviderFree)
		return channel
	}
	if channel := s.peekLumia(); channel != nil && s.takeLumia() {
		s.tried[channel.Id] = true
		s.recordAttempt(channel, HwProviderLumia)
		return channel
	}
	if s.outageRetryPending() {
		s.lumiaRetried = true
		hwPauseBeforeLumiaRetry()
		s.recordAttempt(s.lastChannel, HwProviderLumia)
		return s.lastChannel
	}
	if channel := s.peekAlternate(); channel != nil {
		s.tried[channel.Id] = true
		s.recordAttempt(channel, HwChannelProvider(channel))
		return channel
	}
	return nil
}

// hwLumiaCooldownCap is the longest cooldown the Lumia breaker escalates to.
const hwLumiaCooldownCap = 5 * time.Minute

// hwLumiaClock is the clock of the Lumia breaker; tests replace it.
var hwLumiaClock = time.Now

// hwLumiaBreaker is the process-wide circuit breaker of the whole Lumia account.
// Every Lumia channel shares one account, so an outage hits all of them at once
// (30 and 31 Oct 2026: a 429 after 14 to 31 s on each channel). It is closed
// while failures is zero, open until `until`, then half-open: one request may
// probe Lumia, leased through probeUntil, while the rest treat Lumia as cooling.
var hwLumiaBreaker = struct {
	sync.Mutex
	failures   int
	until      time.Time
	probeUntil time.Time
}{}

// hwLumiaCooldownLength is the cooldown after the failures-th consecutive
// outage failure: HwLumiaCooldownMs, doubled per further failure up to
// hwLumiaCooldownCap. The same length is the lease of a probe that never
// reports back.
func hwLumiaCooldownLength(failures int) time.Duration {
	base := time.Duration(common.HwLumiaCooldownMs) * time.Millisecond
	limit := max(base, hwLumiaCooldownCap)
	length := base
	for range failures - 1 {
		length = min(length*2, limit)
	}
	return length
}

// hwLumiaAllows reports whether a request may use Lumia now. With take it also
// leases the single probe slot of a half-open breaker and returns that lease, so
// the caller must go on to use Lumia and later hand the lease back. The lease is
// zero when nothing was leased: a closed or disabled breaker needs no slot. A
// breaker that is off (HwLumiaCooldownMs <= 0) allows everything.
func hwLumiaAllows(take bool) (allowed bool, lease time.Time) {
	if common.HwLumiaCooldownMs <= 0 {
		return true, time.Time{}
	}
	hwLumiaBreaker.Lock()
	defer hwLumiaBreaker.Unlock()
	if hwLumiaBreaker.failures == 0 {
		return true, time.Time{}
	}
	now := hwLumiaClock()
	if now.Before(hwLumiaBreaker.until) || now.Before(hwLumiaBreaker.probeUntil) {
		return false, time.Time{}
	}
	if take {
		hwLumiaBreaker.probeUntil = now.Add(hwLumiaCooldownLength(hwLumiaBreaker.failures))
		lease = hwLumiaBreaker.probeUntil
	}
	return true, lease
}

// takeLumia spends a Lumia attempt of this request: it checks the breaker and,
// when the breaker is half-open, remembers the probe lease so the request can
// give the slot back (releaseProbe) if it ends without a verdict on Lumia.
func (s *HwRouteState) takeLumia() bool {
	allowed, lease := hwLumiaAllows(true)
	if allowed && !lease.IsZero() {
		s.probe = lease
	}
	return allowed
}

// releaseProbe gives the probe slot back when this request still holds it and
// nothing resolved it: a success or an outage failure already closed or reopened
// the breaker and replaced the lease. It frees the slot only; failures and the
// escalation stay, so the next request probes at the same cooldown length. A
// lease that expired and was taken again by another request is not touched.
func (s *HwRouteState) releaseProbe() {
	if s == nil || s.probe.IsZero() {
		return
	}
	lease := s.probe
	s.probe = time.Time{}
	hwLumiaBreaker.Lock()
	defer hwLumiaBreaker.Unlock()
	if hwLumiaBreaker.probeUntil.Equal(lease) {
		hwLumiaBreaker.probeUntil = time.Time{}
	}
}

// HwReleaseLumiaProbe runs once at the end of every relay request that selects
// channels. A request that took the probe slot of the half-open Lumia breaker and
// ends without success or an outage failure (client cancel, a reply that is no
// outage, a setup, billing or body error, a task submission) would otherwise keep
// the slot for the whole lease while Lumia may answer fine.
func HwReleaseLumiaProbe(c *gin.Context) {
	HwRoute(c).releaseProbe()
}

// hwLumiaFailed records an outage failure of any Lumia channel. It opens the
// breaker, or reopens it with the next longer cooldown when it was the probe
// that failed. A failure that arrives while the cooldown already runs belongs
// to a request that started before it and changes nothing.
func hwLumiaFailed() {
	if common.HwLumiaCooldownMs <= 0 {
		return
	}
	hwLumiaBreaker.Lock()
	defer hwLumiaBreaker.Unlock()
	now := hwLumiaClock()
	if now.Before(hwLumiaBreaker.until) {
		return
	}
	hwLumiaBreaker.failures++
	hwLumiaBreaker.until = now.Add(hwLumiaCooldownLength(hwLumiaBreaker.failures))
	hwLumiaBreaker.probeUntil = time.Time{}
}

// HwNoteSupplierSuccess closes the Lumia breaker when a Lumia channel answered,
// so a recovered supplier carries the traffic again at once.
func HwNoteSupplierSuccess(c *gin.Context) {
	state := HwRoute(c)
	if state == nil || state.lastChannel == nil || HwChannelProvider(state.lastChannel) != HwProviderLumia {
		return
	}
	state.probe = time.Time{}
	HwNoteModelHealthy(state.model)
	hwLumiaBreaker.Lock()
	defer hwLumiaBreaker.Unlock()
	hwLumiaBreaker.failures = 0
	hwLumiaBreaker.until = time.Time{}
	hwLumiaBreaker.probeUntil = time.Time{}
}

// hwPauseBeforeLumiaRetry waits the configured pause, but never longer than the
// caller is prepared to wait for a broken supplier.
func hwPauseBeforeLumiaRetry() {
	if common.HwLumiaRetryPauseMs <= 0 {
		return
	}
	time.Sleep(time.Duration(common.HwLumiaRetryPauseMs) * time.Millisecond)
}

// HwFirstChannel validates the channel the distributor already picked and
// replaces it when supplier rules forbid it. Returning (nil, nil) keeps the
// picked channel untouched.
func HwFirstChannel(c *gin.Context, current *model.Channel, group, modelName string) (*model.Channel, *types.NewAPIError) {
	if c == nil || current == nil {
		return nil, nil
	}
	state := hwStartRoute(c, group, modelName, GetChannelConstraints(c).Filters)
	if state == nil {
		return nil, nil
	}
	if state.claim(current) {
		return nil, nil
	}
	channel := state.next()
	if channel == nil {
		state.finished = true
		return nil, HwServiceBusyError(c)
	}
	return channel, nil
}

// HwSelectChannel serves the retry path of the relay loop. The stock selection
// runs once (when the route is not built yet) so auto-group handling and the
// cache stay authoritative; after that the route decides.
func HwSelectChannel(c *gin.Context, retryParam *RetryParam, stock func() (*model.Channel, string, error)) (*model.Channel, string, error) {
	modelName := ""
	if retryParam != nil {
		modelName = retryParam.ModelName
	}
	state := HwRoute(c)
	if state == nil {
		channel, group, err := stock()
		if err != nil || channel == nil {
			return channel, group, err
		}
		state = hwStartRoute(c, group, modelName, GetChannelConstraints(c).Filters)
		if state == nil {
			return channel, group, nil
		}
		if state.claim(channel) {
			return channel, group, nil
		}
	}
	channel := state.next()
	if channel == nil {
		state.finished = true
		return nil, state.group, HwServiceBusyError(c)
	}
	return channel, state.group, nil
}

// HwRetryLoopExtends tells the relay loop that the supplier route still has an
// attempt left, independently of the configured RetryTimes.
func HwRetryLoopExtends(c *gin.Context) bool {
	state := HwRoute(c)
	if state == nil {
		return false
	}
	return state.hasNext()
}

// HwDecideRetry replaces the generic retry decision for supplier-routed
// requests. It also records the failure class that drives the outage retry.
func HwDecideRetry(c *gin.Context, apiErr *types.NewAPIError) (PolicyDecision, bool) {
	state := HwRoute(c)
	if state == nil {
		return PolicyDecision{}, false
	}
	if apiErr == nil {
		return hwPolicyDecision("stop", "hw_no_error"), true
	}
	if hwIsSupplierCreditError(apiErr) && state.lastChannel != nil {
		// Fixed marker for the supplier health check of the office board: one
		// line per failure, channel and model only, never the supplier text.
		logger.LogWarn(c, common.LogText("hw supplier credit exhausted: channel_id=%d model=%s", state.lastChannel.Id, state.model))
		HwNoteModelCreditFailure(state.model)
		state.credit = HwChannelProvider(state.lastChannel) == HwProviderLumia
		if state.credit {
			// Only Lumia's own Anthropic credit is the CEO route's concern.
			HwCountSupplierCreditFailure(state.lastChannel.Id, state.model, time.Now())
		}
	}
	if types.IsSkipRetryError(apiErr) || apiErr.GetErrorCode() == HwErrorCodeServiceBusy {
		state.finished = true
		return hwPolicyDecision("stop", "hw_terminal_error"), true
	}
	// Only a Lumia outage earns the paused extra Lumia attempt; a free tier
	// running out of quota simply moves on to the next supplier.
	if HwChannelProvider(state.lastChannel) == HwProviderLumia {
		if hwIsOutageError(apiErr) {
			state.outage = true
			// A client that hung up cancels the upstream call, which surfaces as
			// an outage error. It says nothing about Lumia and must not cool the
			// account for every other customer.
			if !hwClientGone(c) {
				hwLumiaFailed()
			}
		}
		// This Lumia attempt is over. An outage failure above already replaced
		// the lease; any other end (a cancel, a reply that is no outage) gives
		// the probe slot back now, before a fallback attempt keeps it busy.
		state.releaseProbe()
	}
	if state.streamWrites > 0 {
		// The customer already received data; switching supplier now would
		// splice two different answers together.
		state.streamCut = true
	}
	if !state.hasNext() {
		state.finished = true
		return hwPolicyDecision("stop", "hw_route_exhausted"), true
	}
	return hwPolicyDecision("retry", "hw_supplier_route"), true
}

func hwPolicyDecision(action, reason string) PolicyDecision {
	return PolicyDecision{Action: action, Reason: reason, Source: "supplier_policy"}
}

// hwClientGone reports whether the customer's request was cancelled or timed
// out: the upstream call runs on that context, so its failure is then the
// customer's doing and not the supplier's.
func hwClientGone(c *gin.Context) bool {
	return c != nil && c.Request != nil && c.Request.Context().Err() != nil
}

// hwIsOutageError classifies supplier failures that justify the extra Lumia
// attempt: timeouts, connection failures, 5xx and 429.
func hwIsOutageError(apiErr *types.NewAPIError) bool {
	if apiErr == nil {
		return false
	}
	if apiErr.StatusCode == http.StatusTooManyRequests {
		return true
	}
	if apiErr.StatusCode >= http.StatusInternalServerError && apiErr.StatusCode <= 599 {
		return true
	}
	switch apiErr.GetErrorCode() {
	case types.ErrorCodeDoRequestFailed,
		types.ErrorCodeReadResponseBodyFailed,
		types.ErrorCodeBadResponse,
		types.ErrorCodeBadResponseStatusCode,
		HwErrorCodeStreamInterrupted:
		return true
	}
	return false
}

// hwSupplierCreditPhrases are the wordings suppliers use when their own account
// with the model vendor has no credit left. Lumia answers with the vendor's 400
// "Your credit balance is too low ..." for some models while others keep
// working (4 Nov 2026), so it is no customer mistake and no reason to cool the
// whole supplier.
var hwSupplierCreditPhrases = []string{
	"credit balance is too low",
	"insufficient_quota",
	"exceeded your current quota",
	"insufficient balance",
	"purchase credits",
}

// hwIsSupplierCreditError reports whether a supplier refused because its own
// account is out of credit. The gateway's own refusals (the customer's quota,
// access control) never count: they carry one of our own error codes.
func hwIsSupplierCreditError(apiErr *types.NewAPIError) bool {
	if apiErr == nil || apiErr.StatusCode < http.StatusBadRequest || apiErr.StatusCode >= http.StatusInternalServerError {
		return false
	}
	if HwIsOwnErrorCode(string(apiErr.GetErrorCode())) {
		return false
	}
	message := strings.ToLower(apiErr.Error())
	return slices.ContainsFunc(hwSupplierCreditPhrases, func(phrase string) bool {
		return strings.Contains(message, phrase)
	})
}

// hwSupplierStreamCut classifies a supplier stream that ended without its
// protocol terminal event. visible reports that the customer already received
// output, which decides between an error event and a retry.
func hwSupplierStreamCut(c *gin.Context, info *relaycommon.RelayInfo) (visible, cut bool) {
	state := HwRoute(c)
	if state == nil || info == nil || !info.IsStream || info.StreamStatus == nil {
		return false, false
	}
	outcome := info.StreamStatus.OutcomeSnapshot()
	if !outcome.ExpectsTerminal || outcome.Response != relaycommon.ResponseOutcomeUnknown {
		return false, false
	}
	switch outcome.EndReason {
	case relaycommon.StreamEndReasonEOF,
		relaycommon.StreamEndReasonScannerErr,
		relaycommon.StreamEndReasonTimeout:
	default:
		return false, false
	}
	return info.ReceivedResponseCount > 0 || state.streamWrites > 0, true
}

// HwStreamCutShort detects a supplier stream that ended before its protocol
// terminal event. With chunks already sent the customer gets a clean error
// event and no retry; without chunks the normal supplier order continues.
func HwStreamCutShort(c *gin.Context, info *relaycommon.RelayInfo) *types.NewAPIError {
	visible, cut := hwSupplierStreamCut(c, info)
	if !cut {
		return nil
	}
	if visible {
		if state := HwRoute(c); state != nil {
			state.streamCut = true
		}
		return types.NewErrorWithStatusCode(
			errors.New("supplier stream ended before completion"),
			HwErrorCodeStreamInterrupted,
			http.StatusBadGateway,
			types.ErrOptionWithSkipRetry(),
		)
	}
	return types.NewErrorWithStatusCode(
		errors.New("supplier stream ended before its first chunk"),
		HwErrorCodeStreamInterrupted,
		http.StatusBadGateway,
	)
}

// HwStreamCutBeforeOutput reports whether this attempt is a supplier stream that
// ended before its terminal event while the customer had not seen any output
// yet. The route retries such an attempt, so it must not be settled: settling it
// charges the prompt estimate of an answer nobody saw and turns the settlement
// of the retry into a no-op, which leaves the completion tokens unbilled.
func HwStreamCutBeforeOutput(c *gin.Context, info *relaycommon.RelayInfo) bool {
	visible, cut := hwSupplierStreamCut(c, info)
	return cut && !visible
}

// HwClientGoneBeforeOutput reports a stream the customer abandoned before any
// chunk arrived or was written. The first-response time also covers stream
// paths outside the SSE scanner, such as the Responses WebSocket. Nothing was delivered, so the attempt settles at
// zero; unlike a supplier cut there is no retry that would bill the answer.
func HwClientGoneBeforeOutput(c *gin.Context, info *relaycommon.RelayInfo) bool {
	if info == nil || !info.IsStream || info.StreamStatus == nil || info.ReceivedResponseCount > 0 || info.HasSendResponse() {
		return false
	}
	if state := HwRoute(c); state != nil && state.streamWrites > 0 {
		return false
	}
	return info.StreamStatus.OutcomeSnapshot().EndReason == relaycommon.StreamEndReasonClientGone
}

// HwNoteStreamWrite records that a stream chunk reached the customer. It is
// called by the masking writer, which is the only component that knows what was
// actually written.
func HwNoteStreamWrite(c *gin.Context) {
	if state := HwRoute(c); state != nil {
		state.streamWrites++
	}
}

// HwNoteAbandonedAttempt keeps the supplier prompt count of an attempt whose
// stream ended before the customer saw output. That attempt is retried and not
// settled, but the supplier may still invoice its prompt; the count lands in the
// admin-only part of the request's single log so the invoice can be reconciled.
func HwNoteAbandonedAttempt(c *gin.Context, promptTokens int) {
	state := HwRoute(c)
	if state == nil || promptTokens <= 0 {
		return
	}
	state.abandonedPrompt += promptTokens
}

// HwNoteMaskAlert records that the last-resort scan had to rewrite provider
// traces. Only the count is logged; the content never is.
func HwNoteMaskAlert(c *gin.Context) {
	if state := HwRoute(c); state != nil {
		state.maskAlerts++
	}
}

// HwNoteUpstreamIdentity keeps the upstream response ids for the admin log, so
// the customer-visible id can be our own.
func HwNoteUpstreamIdentity(c *gin.Context, id string) {
	state := HwRoute(c)
	if state == nil {
		return
	}
	identity := strings.TrimSpace(id)
	if identity == "" {
		return
	}
	for _, existing := range state.upstreamIDs {
		if existing == identity {
			return
		}
	}
	if len(state.upstreamIDs) < hwMaxUpstreamIDs {
		state.upstreamIDs = append(state.upstreamIDs, identity)
	}
}

// HwAppendRelayLogAdminInfo writes the supplier facts into the admin-only part
// of the request log. The customer projection of a log line never contains them.
func HwAppendRelayLogAdminInfo(c *gin.Context, other *model.LogOther) {
	state := HwRoute(c)
	if state == nil || other == nil || state.channelID == 0 {
		return
	}
	other.SetAdmin("provider", state.provider)
	other.SetAdmin("provider_channel_id", state.channelID)
	other.SetAdmin("provider_attempts", state.attempts)
	other.SetAdmin("provider_fallback", state.fallback)
	if state.blockedByFamily > 0 {
		other.SetAdmin("provider_family_blocked", state.blockedByFamily)
	}
	if len(state.upstreamIDs) > 0 {
		other.SetAdmin("provider_upstream_ids", state.upstreamIDs)
	}
	if state.streamCut {
		other.SetAdmin("provider_stream_interrupted", true)
	}
	if state.abandonedPrompt > 0 {
		other.SetAdmin("provider_abandoned_prompt_tokens", state.abandonedPrompt)
	}
	if state.maskAlerts > 0 {
		other.SetAdmin("provider_mask_alerts", state.maskAlerts)
	}
}

// HwTerminalError replaces an exhausted supplier route's last upstream error
// with the fork's own service_busy error, so an outage never surfaces upstream
// wording or a supplier-flavoured status. Client-side failures (4xx) keep their
// own class; masking replaces their text instead.
func HwTerminalError(c *gin.Context, apiErr *types.NewAPIError, decision PolicyDecision) *types.NewAPIError {
	state := HwRoute(c)
	if state == nil || apiErr == nil || decision.Action == "retry" {
		return nil
	}
	if hwIsSupplierCreditError(apiErr) {
		return HwModelUnavailableError(c, state.model)
	}
	if HwIsOwnErrorCode(string(apiErr.GetErrorCode())) || types.IsSkipRetryError(apiErr) {
		return nil
	}
	if !hwIsOutageError(apiErr) {
		return nil
	}
	return HwServiceBusyError(c)
}

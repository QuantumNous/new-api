package service

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"hash/fnv"
	"io"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/gin-gonic/gin"
)

var ErrSchedulerPolicyUnavailable = errors.New("scheduler effective policy is unavailable")
var ErrSchedulerTemporarilyUnavailable = errors.New("scheduler temporarily unavailable")

// schedulerDefaultMode is the platform default routing mode applied when a user
// has no explicit routing preference for the requested model.
const schedulerDefaultMode = "balanced"

const schedulerDefaultRuntimeHighWatermark = 0.8

type SchedulerClientConfig struct {
	Enabled              bool
	BaseURL              string
	BootstrapURLs        []string
	LocalURL             string
	Token                string
	SigningSecret        string
	Timeout              time.Duration
	Mode                 string
	CanaryPercent        int
	CanarySalt           string
	RuntimeHighWatermark float64
	EmergencyNative      bool
	EmergencyMaxDuration time.Duration
	EmergencyGroups      []string
	EmergencyModels      []string
	EmergencyLocalSwitch bool
}

func (c SchedulerClientConfig) URLs() []string {
	return schedulerResolvedURLs(c)
}

type SchedulerCandidate struct {
	EndpointID    string   `json:"endpoint_id"`
	ChannelID     int      `json:"channel_id"`
	KeyIndex      int      `json:"key_index"`
	Model         string   `json:"model"`
	UpstreamModel string   `json:"upstream_model,omitempty"`
	Reason        []string `json:"reason"`
}
type schedulerRequest struct {
	RequestID              string         `json:"request_id"`
	UserID                 int64          `json:"user_id,omitempty"`
	TokenID                int64          `json:"token_id,omitempty"`
	Group                  string         `json:"group,omitempty"`
	Model                  string         `json:"model"`
	Workload               string         `json:"workload,omitempty"`
	Capabilities           map[string]any `json:"capabilities"`
	Policy                 map[string]any `json:"policy"`
	EstimatedInputTokens   int            `json:"estimated_input_tokens"`
	MaxOutputTokens        int            `json:"max_output_tokens"`
	AllowedChannelIDs      []int          `json:"allowed_channel_ids"`
	PreferredChannelID     int            `json:"preferred_channel_id,omitempty"`
	AffinityKeyFingerprint string         `json:"affinity_key_fingerprint,omitempty"`
}

type schedulerRequestShape struct {
	Stream              bool            `json:"stream"`
	Tools               json.RawMessage `json:"tools"`
	MaxTokens           int             `json:"max_tokens"`
	MaxCompletionTokens int             `json:"max_completion_tokens"`
	ResponseFormat      *struct {
		Type string `json:"type"`
	} `json:"response_format"`
}
type schedulerResponse struct {
	DecisionID        string `json:"decision_id"`
	ScoreVersion      string `json:"score_version,omitempty"`
	PreferenceVersion string `json:"preference_version,omitempty"`
	CatalogVersion    string `json:"catalog_version"`
	Reservation       *struct {
		ReservationID   string `json:"reservation_id"`
		EstimatedTokens int    `json:"estimated_tokens"`
	} `json:"reservation,omitempty"`
	Candidates []SchedulerCandidate `json:"candidates"`
}
type schedulerReserveRequest struct {
	RequestID       string `json:"request_id"`
	DecisionID      string `json:"decision_id"`
	AttemptNo       int    `json:"attempt_no"`
	EndpointID      string `json:"endpoint_id"`
	EstimatedTokens int    `json:"estimated_tokens"`
}
type schedulerResizeRequest struct {
	RequestID       string `json:"request_id"`
	DecisionID      string `json:"decision_id"`
	AttemptNo       int    `json:"attempt_no"`
	EndpointID      string `json:"endpoint_id"`
	ReservationID   string `json:"reservation_id"`
	EstimatedTokens int    `json:"estimated_tokens"`
}
type schedulerAttempt struct {
	RequestID       string `json:"request_id"`
	DecisionID      string `json:"decision_id"`
	AttemptNo       int    `json:"attempt_no"`
	EndpointID      string `json:"endpoint_id"`
	ReservationID   string `json:"reservation_id"`
	StatusCode      int    `json:"status_code"`
	ErrorType       string `json:"error_type"`
	Success         bool   `json:"success"`
	StreamStarted   bool   `json:"stream_started"`
	LatencyMS       int64  `json:"latency_ms"`
	TTFTMS          int64  `json:"ttft_ms,omitempty"`
	InputTokens     int    `json:"input_tokens"`
	OutputTokens    int    `json:"output_tokens"`
	EstimatedTokens int    `json:"estimated_tokens,omitempty"`
	UsageUnverified bool   `json:"usage_unverified,omitempty"`
}

var schedulerConfigState struct {
	sync.RWMutex
	loaded       bool
	testOverride bool
	config       SchedulerClientConfig
}

var schedulerAttemptAsyncSlots = make(chan struct{}, 256)

const (
	schedulerCircuitFailureThreshold = 3
	schedulerCircuitProbeInterval    = 10 * time.Second
	schedulerEmergencyMaxDuration    = 10 * time.Minute
)

var schedulerCircuitState struct {
	sync.Mutex
	failures       int
	failedAt       time.Time
	openedAt       time.Time
	halfOpen       bool
	probeSuccesses int
}

type schedulerEndpointCircuit struct {
	failures       int
	failedAt       time.Time
	openedAt       time.Time
	halfOpen       bool
	probeSuccesses int
}

var schedulerEndpointCircuitState struct {
	sync.Mutex
	states map[string]*schedulerEndpointCircuit
}

func resetSchedulerCircuit() {
	schedulerCircuitState.Lock()
	schedulerCircuitState.failures = 0
	schedulerCircuitState.failedAt = time.Time{}
	schedulerCircuitState.openedAt = time.Time{}
	schedulerCircuitState.halfOpen = false
	schedulerCircuitState.probeSuccesses = 0
	schedulerCircuitState.Unlock()
	schedulerEndpointCircuitState.Lock()
	schedulerEndpointCircuitState.states = make(map[string]*schedulerEndpointCircuit)
	schedulerEndpointCircuitState.Unlock()
}

func schedulerCircuitAllows(now time.Time) bool {
	schedulerCircuitState.Lock()
	defer schedulerCircuitState.Unlock()
	if schedulerCircuitState.openedAt.IsZero() {
		return true
	}
	if now.Sub(schedulerCircuitState.openedAt) < schedulerCircuitProbeInterval {
		return false
	}
	if schedulerCircuitState.halfOpen {
		return false
	}
	schedulerCircuitState.halfOpen = true
	return true
}

func schedulerCircuitFailure(now time.Time) {
	schedulerCircuitState.Lock()
	defer schedulerCircuitState.Unlock()
	if schedulerCircuitState.openedAt.IsZero() {
		if schedulerCircuitState.failedAt.IsZero() {
			schedulerCircuitState.failedAt = now
		}
		schedulerCircuitState.failures++
		if schedulerCircuitState.failures >= schedulerCircuitFailureThreshold {
			schedulerCircuitState.openedAt = now
			schedulerCircuitState.halfOpen = false
		}
		return
	}
	schedulerCircuitState.openedAt = now
	schedulerCircuitState.halfOpen = false
	schedulerCircuitState.probeSuccesses = 0
}

func schedulerCircuitSuccess(now time.Time) {
	schedulerCircuitState.Lock()
	defer schedulerCircuitState.Unlock()
	if !schedulerCircuitState.openedAt.IsZero() {
		if schedulerCircuitState.halfOpen {
			schedulerCircuitState.probeSuccesses++
			schedulerCircuitState.halfOpen = false
			if schedulerCircuitState.probeSuccesses >= 2 {
				schedulerCircuitState.failures = 0
				schedulerCircuitState.failedAt = time.Time{}
				schedulerCircuitState.openedAt = time.Time{}
				schedulerCircuitState.probeSuccesses = 0
			} else {
				// Keep the circuit open between half-open probes so only one
				// request probes Scheduler during each interval.
				schedulerCircuitState.openedAt = now
			}
		}
		return
	}
	schedulerCircuitState.failures = 0
	schedulerCircuitState.failedAt = time.Time{}
	schedulerCircuitState.probeSuccesses = 0
}

func schedulerCircuitEmergencyActive(now time.Time, maxDuration time.Duration) bool {
	schedulerCircuitState.Lock()
	defer schedulerCircuitState.Unlock()
	if schedulerCircuitState.failedAt.IsZero() {
		return false
	}
	if maxDuration <= 0 {
		maxDuration = schedulerEmergencyMaxDuration
	}
	return now.Sub(schedulerCircuitState.failedAt) < maxDuration
}

func schedulerEndpointCircuitForLocked(endpoint string) *schedulerEndpointCircuit {
	if schedulerEndpointCircuitState.states == nil {
		schedulerEndpointCircuitState.states = make(map[string]*schedulerEndpointCircuit)
	}
	circuit, ok := schedulerEndpointCircuitState.states[endpoint]
	if !ok {
		circuit = &schedulerEndpointCircuit{}
		schedulerEndpointCircuitState.states[endpoint] = circuit
	}
	return circuit
}

func schedulerEndpointCircuitAllows(endpoint string, now time.Time) bool {
	endpoint = strings.TrimRight(strings.TrimSpace(endpoint), "/")
	if endpoint == "" {
		return false
	}
	schedulerEndpointCircuitState.Lock()
	defer schedulerEndpointCircuitState.Unlock()
	circuit := schedulerEndpointCircuitForLocked(endpoint)
	if circuit.openedAt.IsZero() {
		return true
	}
	if now.Sub(circuit.openedAt) < schedulerCircuitProbeInterval {
		return false
	}
	if circuit.halfOpen {
		return false
	}
	circuit.halfOpen = true
	return true
}

func schedulerEndpointCircuitFailure(endpoint string, now time.Time) {
	endpoint = strings.TrimRight(strings.TrimSpace(endpoint), "/")
	if endpoint == "" {
		return
	}
	schedulerEndpointCircuitState.Lock()
	defer schedulerEndpointCircuitState.Unlock()
	circuit := schedulerEndpointCircuitForLocked(endpoint)
	if circuit.openedAt.IsZero() {
		if circuit.failedAt.IsZero() {
			circuit.failedAt = now
		}
		circuit.failures++
		if circuit.failures >= schedulerCircuitFailureThreshold {
			circuit.openedAt = now
			circuit.halfOpen = false
		}
		return
	}
	circuit.openedAt = now
	circuit.halfOpen = false
	circuit.probeSuccesses = 0
}

func schedulerEndpointCircuitSuccess(endpoint string, now time.Time) {
	endpoint = strings.TrimRight(strings.TrimSpace(endpoint), "/")
	if endpoint == "" {
		return
	}
	schedulerEndpointCircuitState.Lock()
	defer schedulerEndpointCircuitState.Unlock()
	circuit := schedulerEndpointCircuitForLocked(endpoint)
	if !circuit.openedAt.IsZero() {
		if circuit.halfOpen {
			circuit.probeSuccesses++
			circuit.halfOpen = false
			if circuit.probeSuccesses >= 2 {
				circuit.failures = 0
				circuit.failedAt = time.Time{}
				circuit.openedAt = time.Time{}
				circuit.probeSuccesses = 0
			} else {
				circuit.openedAt = now
			}
		}
		return
	}
	circuit.failures = 0
	circuit.failedAt = time.Time{}
	circuit.probeSuccesses = 0
}

func schedulerNormalizedURLs(values ...string) []string {
	result := make([]string, 0, len(values))
	seen := make(map[string]struct{}, len(values))
	for _, value := range values {
		value = strings.TrimRight(strings.TrimSpace(value), "/")
		if value == "" {
			continue
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		result = append(result, value)
	}
	return result
}

func schedulerResolvedURLs(config SchedulerClientConfig) []string {
	values := make([]string, 0, 2+len(config.BootstrapURLs))
	if strings.TrimSpace(config.LocalURL) != "" {
		values = append(values, config.LocalURL)
	}
	values = append(values, config.BootstrapURLs...)
	if len(values) == 0 && strings.TrimSpace(config.BaseURL) != "" {
		values = append(values, config.BaseURL)
	}
	return schedulerNormalizedURLs(values...)
}

func schedulerOptionURLs(key, envKey string) []string {
	raw := schedulerOption(key, envKey, "")
	if strings.TrimSpace(raw) == "" {
		return nil
	}
	parts := strings.Split(raw, ",")
	result := make([]string, 0, len(parts))
	for _, part := range parts {
		if value := strings.TrimSpace(part); value != "" {
			result = append(result, strings.TrimRight(value, "/"))
		}
	}
	return schedulerNormalizedURLs(result...)
}

func isTransientSchedulerError(err error) bool {
	if err == nil || errors.Is(err, context.Canceled) {
		return false
	}
	if errors.Is(err, ErrSchedulerTemporarilyUnavailable) {
		return true
	}
	if errors.Is(err, context.DeadlineExceeded) {
		return true
	}
	var timeout interface{ Timeout() bool }
	if errors.As(err, &timeout) && timeout.Timeout() {
		return true
	}
	message := strings.ToLower(err.Error())
	return strings.Contains(message, "connection refused") ||
		strings.Contains(message, "connection reset") ||
		strings.Contains(message, "no such host") ||
		strings.Contains(message, "scheduler status 502") ||
		strings.Contains(message, "scheduler status 503") ||
		strings.Contains(message, "scheduler status 504")
}

func SchedulerClient() SchedulerClientConfig {
	schedulerConfigState.RLock()
	if schedulerConfigState.testOverride {
		c := schedulerConfigState.config
		schedulerConfigState.RUnlock()
		return c
	}
	schedulerConfigState.RUnlock()
	return schedulerClientConfigFromOptions()
}

// schedulerClientConfigFromOptions builds a fresh production configuration on
// every call. OptionMap is already protected by its RWMutex and is refreshed by
// SyncOptions on every node, so mode/canary/emergency changes cannot remain
// trapped in a stale process-local SchedulerClient cache.
func schedulerClientConfigFromOptions() SchedulerClientConfig {
	timeout := time.Duration(schedulerOptionInt("SchedulerShadowTimeoutMS", "SCHEDULER_SHADOW_TIMEOUT_MS", 100)) * time.Millisecond
	canaryPercent, _ := strconv.Atoi(strings.TrimSpace(schedulerOption("SchedulerCanaryPercent", "SCHEDULER_CANARY_PERCENT", "0")))
	canarySalt := strings.TrimSpace(schedulerOption("SchedulerCanarySalt", "SCHEDULER_CANARY_SALT", "scheduler-v2"))
	if canarySalt == "" {
		canarySalt = "scheduler-v2"
	}
	mode := strings.ToLower(strings.TrimSpace(schedulerOption("SchedulerMode", "SCHEDULER_MODE", "shadow")))
	if mode == "" {
		mode = "shadow"
	}
	highWatermark := schedulerOptionFloat("SchedulerRuntimeHighWatermark", "SCHEDULER_RUNTIME_HIGH_WATERMARK", schedulerDefaultRuntimeHighWatermark)
	emergencyMaxDuration := time.Duration(schedulerOptionInt("SchedulerEmergencyMaxDurationSeconds", "SCHEDULER_EMERGENCY_MAX_DURATION_SECONDS", int(schedulerEmergencyMaxDuration/time.Second))) * time.Second
	if emergencyMaxDuration <= 0 {
		emergencyMaxDuration = schedulerEmergencyMaxDuration
	}
	bootstrapURLs := schedulerOptionList("SchedulerBootstrapURLs")
	localURL := strings.TrimRight(strings.TrimSpace(schedulerOption("SchedulerLocalURL", "SCHEDULER_LOCAL_URL", "")), "/")
	baseURL := ""
	switch {
	case localURL != "":
		baseURL = localURL
	case len(bootstrapURLs) > 0:
		baseURL = bootstrapURLs[0]
	}
	return SchedulerClientConfig{
		Enabled:       schedulerOptionBool("SchedulerEnabled", "SCHEDULER_ENABLED", false),
		BaseURL:       baseURL,
		BootstrapURLs: bootstrapURLs,
		LocalURL:      localURL,
		Token:         schedulerOption("SchedulerToken", "SCHEDULER_TOKEN", ""),
		SigningSecret: schedulerOption("SchedulerSigningSecret", "SCHEDULER_SIGNING_SECRET", ""),
		Timeout:       timeout, Mode: mode, CanaryPercent: canaryPercent, CanarySalt: canarySalt,
		RuntimeHighWatermark: highWatermark,
		// Central enablement is persisted in OptionMap. The local process
		// switch below is intentionally env-only and must be enabled too.
		EmergencyNative:      schedulerOptionBool("SchedulerEmergencyNativeRouting", "", false),
		EmergencyMaxDuration: emergencyMaxDuration,
		EmergencyGroups:      schedulerOptionList("SchedulerEmergencyGroups"),
		EmergencyModels:      schedulerOptionList("SchedulerEmergencyModels"),
		EmergencyLocalSwitch: strings.EqualFold(strings.TrimSpace(os.Getenv("SCHEDULER_EMERGENCY_NATIVE_ROUTING")), "true") || os.Getenv("SCHEDULER_EMERGENCY_NATIVE_ROUTING") == "1",
	}
}

func schedulerOption(key, envKey, fallback string) string {
	common.OptionMapRWMutex.RLock()
	value, ok := common.OptionMap[key]
	common.OptionMapRWMutex.RUnlock()
	if ok {
		return value
	}
	if value = strings.TrimSpace(os.Getenv(envKey)); value != "" {
		return value
	}
	return fallback
}

func schedulerOptionInt(key, envKey string, fallback int) int {
	value, err := strconv.Atoi(strings.TrimSpace(schedulerOption(key, envKey, "")))
	if err != nil || value < 1 {
		return fallback
	}
	return value
}

func schedulerOptionBool(key, envKey string, fallback bool) bool {
	value := strings.ToLower(strings.TrimSpace(schedulerOption(key, envKey, "")))
	if value == "true" || value == "1" {
		return true
	}
	if value == "false" || value == "0" {
		return false
	}
	return fallback
}

func schedulerOptionFloat(key, envKey string, fallback float64) float64 {
	value, err := strconv.ParseFloat(strings.TrimSpace(schedulerOption(key, envKey, "")), 64)
	if err != nil || value <= 0 || value >= 1 {
		return fallback
	}
	return value
}

func schedulerOptionList(key string) []string {
	value := schedulerOption(key, "", "")
	parts := strings.Split(value, ",")
	result := make([]string, 0, len(parts))
	for _, part := range parts {
		if trimmed := strings.TrimSpace(part); trimmed != "" {
			result = append(result, trimmed)
		}
	}
	return result
}

type schedulerRequestOutcome struct {
	endpoint string
	status   int
	body     []byte
	err      error
}

func schedulerDoRequestWithFallback(ctx context.Context, config SchedulerClientConfig, method, path string, payload []byte, includeAuth bool) (schedulerRequestOutcome, error) {
	if ctx == nil {
		ctx = context.Background()
	}
	endpoints := config.URLs()
	if len(endpoints) == 0 {
		return schedulerRequestOutcome{}, ErrSchedulerTemporarilyUnavailable
	}
	if config.Timeout <= 0 {
		config.Timeout = 100 * time.Millisecond
	}
	client := &http.Client{Timeout: config.Timeout}
	var lastErr error
	var transientFailures int
	now := time.Now()
	for _, endpoint := range endpoints {
		if !schedulerEndpointCircuitAllows(endpoint, now) {
			lastErr = ErrSchedulerTemporarilyUnavailable
			continue
		}
		attemptCtx, cancel := context.WithTimeout(ctx, config.Timeout)
		req, err := http.NewRequestWithContext(attemptCtx, method, endpoint+path, bytes.NewReader(payload))
		if err != nil {
			cancel()
			return schedulerRequestOutcome{}, err
		}
		if includeAuth && config.Token != "" {
			req.Header.Set("Authorization", "Bearer "+config.Token)
		}
		req.Header.Set("Content-Type", "application/json")
		if includeAuth {
			signSchedulerRequest(req, config.SigningSecret, payload)
		}
		resp, err := client.Do(req)
		if err != nil {
			cancel()
			if isTransientSchedulerError(err) {
				schedulerEndpointCircuitFailure(endpoint, time.Now())
				transientFailures++
				lastErr = fmt.Errorf("%w: %v", ErrSchedulerTemporarilyUnavailable, err)
				continue
			}
			return schedulerRequestOutcome{}, err
		}
		body, readErr := io.ReadAll(resp.Body)
		_ = resp.Body.Close()
		cancel()
		if readErr != nil {
			schedulerEndpointCircuitFailure(endpoint, time.Now())
			transientFailures++
			lastErr = fmt.Errorf("%w: %v", ErrSchedulerTemporarilyUnavailable, readErr)
			continue
		}
		if resp.StatusCode >= 200 && resp.StatusCode < 300 {
			schedulerEndpointCircuitSuccess(endpoint, time.Now())
			schedulerCircuitSuccess(time.Now())
			return schedulerRequestOutcome{endpoint: endpoint, status: resp.StatusCode, body: body}, nil
		}
		if resp.StatusCode >= 500 {
			schedulerEndpointCircuitFailure(endpoint, time.Now())
			transientFailures++
			lastErr = fmt.Errorf("%w: scheduler status %d", ErrSchedulerTemporarilyUnavailable, resp.StatusCode)
			continue
		}
		return schedulerRequestOutcome{endpoint: endpoint, status: resp.StatusCode, body: body, err: fmt.Errorf("scheduler status %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))}, nil
	}
	schedulerCircuitFailure(time.Now())
	if transientFailures > 0 && lastErr != nil {
		return schedulerRequestOutcome{}, lastErr
	}
	return schedulerRequestOutcome{}, ErrSchedulerTemporarilyUnavailable
}

// ReloadSchedulerClient causes the next request to read the latest persisted
// configuration. It is used by the admin configuration endpoint after a
// successful atomic options update.
func ReloadSchedulerClient() {
	schedulerConfigState.Lock()
	schedulerConfigState.loaded = false
	schedulerConfigState.testOverride = false
	schedulerConfigState.Unlock()
	resetSchedulerCircuit()
}

// ConfigureSchedulerClientForTest allows isolated middleware tests to opt in
// without mutating process environment. It is intentionally not used by boot.
func ConfigureSchedulerClientForTest(config SchedulerClientConfig) {
	schedulerConfigState.Lock()
	schedulerConfigState.config = config
	schedulerConfigState.loaded = true
	schedulerConfigState.testOverride = true
	schedulerConfigState.Unlock()
	resetSchedulerCircuit()
}

func SchedulerEnforced() bool {
	c := SchedulerClient()
	return c.Enabled && c.Mode == "enforced"
}

// SchedulerEnforcedForRequest applies the stable-hash canary gate. The hash
// input is request-scoped and contains no prompt or credential material.
func SchedulerEnforcedForRequest(c *gin.Context) bool {
	// Once an enforced request has started, keep its Scheduler lifecycle
	// enabled so an operator toggling kill switch cannot strand an existing
	// Reservation before its attempt/release is reported.
	if c != nil {
		if value, exists := c.Get(string(constant.ContextKeySchedulerEnforcedRequest)); exists {
			if enforced, ok := value.(bool); ok {
				return enforced
			}
		}
	}
	if SchedulerKillSwitchActive() {
		return false
	}
	config := SchedulerClient()
	if !config.Enabled {
		return false
	}
	result := false
	if config.Mode == "enforced" {
		result = true
	} else if config.Mode != "canary" || config.CanaryPercent <= 0 {
		result = false
	} else {
		percent := config.CanaryPercent
		if percent > 100 {
			percent = 100
		}
		key := ""
		if c != nil {
			if userID := c.GetInt("id"); userID > 0 {
				key = "user:" + strconv.Itoa(userID)
			} else if tokenID := c.GetInt("token_id"); tokenID > 0 {
				key = "token:" + strconv.Itoa(tokenID)
			} else {
				key = "request:" + c.GetString(common.RequestIdKey)
			}
		}
		if key != "" {
			h := fnv.New32a()
			_, _ = h.Write([]byte(config.CanarySalt))
			_, _ = h.Write([]byte{0})
			_, _ = h.Write([]byte(key))
			result = int(h.Sum32()%100) < percent
		}
	}
	if c != nil && result {
		c.Set(string(constant.ContextKeySchedulerEnforcedRequest), true)
	}
	return result
}

// SchedulerKillSwitchActive is intentionally read on every request. The
// management API updates OptionMap synchronously, so operators can stop new
// Scheduler decisions without restarting the process or reloading the client.
func SchedulerKillSwitchActive() bool {
	common.OptionMapRWMutex.RLock()
	value, ok := common.OptionMap["SchedulerKillSwitch"]
	common.OptionMapRWMutex.RUnlock()
	if !ok || strings.TrimSpace(value) == "" {
		value = os.Getenv("SCHEDULER_KILL_SWITCH")
	}
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "true", "1", "yes", "on":
		return true
	default:
		return false
	}
}

// IsSchedulerTransientUnavailable distinguishes infrastructure failures from
// policy, permission, capacity, and invalid-response errors. Only the former
// may enter emergency-native routing.
func IsSchedulerTransientUnavailable(err error) bool {
	return isTransientSchedulerError(err)
}

// SchedulerEmergencyNativeAllowed checks the central option, the local
// process switch, the circuit window, and optional model/group allowlists.
// The default is deliberately false so an enforced request fails closed.
func SchedulerEmergencyNativeAllowed(modelName, group string) bool {
	config := SchedulerClient()
	if !config.EmergencyNative || !config.EmergencyLocalSwitch || !schedulerCircuitEmergencyActive(time.Now(), config.EmergencyMaxDuration) {
		return false
	}
	if len(config.EmergencyModels) > 0 && !containsString(config.EmergencyModels, modelName) {
		return false
	}
	if len(config.EmergencyGroups) > 0 && !containsString(config.EmergencyGroups, group) {
		return false
	}
	return true
}

func containsString(values []string, target string) bool {
	target = strings.TrimSpace(target)
	for _, value := range values {
		if strings.EqualFold(strings.TrimSpace(value), target) {
			return true
		}
	}
	return false
}

// MarkSchedulerEmergency records the request-level degraded routing mode.
// The original error is retained for diagnostics and is never exposed as a
// native routing success signal.
func MarkSchedulerEmergency(c *gin.Context, err error) {
	if c == nil {
		return
	}
	common.SetContextKey(c, constant.ContextKeySchedulerEmergencyNative, true)
	common.SetContextKey(c, constant.ContextKeySchedulerDegradedReason, "scheduler_unavailable")
	if err != nil {
		common.SetContextKey(c, constant.ContextKeySchedulerFailureReason, err.Error())
	}
}

func SchedulerEmergencyNativeActive(c *gin.Context) bool {
	return c != nil && common.GetContextKeyBool(c, constant.ContextKeySchedulerEmergencyNative)
}

// RecordSchedulerUsage stores the usage reported by an upstream handler on
// the request context. Relay reports the attempt after the handler returns,
// so this keeps the scheduler payload aligned with the billing usage that
// new-api actually observed. Missing/negative values are normalized to zero.
func RecordSchedulerUsage(c *gin.Context, usage *dto.Usage, streamStarted bool) {
	if c == nil {
		return
	}
	if usage == nil {
		common.SetContextKey(c, constant.ContextKeySchedulerInputTokens, 0)
		common.SetContextKey(c, constant.ContextKeySchedulerOutputTokens, 0)
		common.SetContextKey(c, constant.ContextKeySchedulerUsageUnverified, true)
		if streamStarted {
			common.SetContextKey(c, constant.ContextKeySchedulerStreamStarted, true)
		}
		return
	}
	input := usage.InputTokens
	if input <= 0 {
		input = usage.PromptTokens
	}
	output := usage.OutputTokens
	if output <= 0 {
		output = usage.CompletionTokens
	}
	if input < 0 {
		input = 0
	}
	if output < 0 {
		output = 0
	}
	common.SetContextKey(c, constant.ContextKeySchedulerInputTokens, input)
	common.SetContextKey(c, constant.ContextKeySchedulerOutputTokens, output)
	usageUnverified := usage.BillingUsage != nil && usage.BillingUsage.Estimated
	common.SetContextKey(c, constant.ContextKeySchedulerUsageUnverified, usageUnverified)
	if streamStarted {
		common.SetContextKey(c, constant.ContextKeySchedulerStreamStarted, true)
	}
}

// ResetSchedulerAttemptMetrics clears usage and stream timing from the
// previous upstream attempt. Relay retries reuse one Gin context; retaining
// these fields would attribute a failed/silent retry the prior attempt's
// tokens or stream state.
func ResetSchedulerAttemptMetrics(c *gin.Context) {
	if c == nil {
		return
	}
	common.SetContextKey(c, constant.ContextKeySchedulerInputTokens, 0)
	common.SetContextKey(c, constant.ContextKeySchedulerOutputTokens, 0)
	common.SetContextKey(c, constant.ContextKeySchedulerUsageUnverified, false)
	common.SetContextKey(c, constant.ContextKeySchedulerStreamStarted, false)
	common.SetContextKey(c, constant.ContextKeySchedulerTTFTMS, 0)
}

func applySchedulerCandidateContext(c *gin.Context, candidate SchedulerCandidate) {
	common.SetContextKey(c, constant.ContextKeySchedulerKeyIndex, candidate.KeyIndex)
	if candidate.UpstreamModel != "" {
		common.SetContextKey(c, constant.ContextKeySchedulerUpstreamModel, candidate.UpstreamModel)
	}
}

// SchedulerCandidateForInitial returns the first Scheduler candidate for the
// initial attempt. It is intentionally inert unless Enforced (including a
// selected Canary request) is active; Shadow keeps native routing authoritative.
func SchedulerCandidateForInitial(c *gin.Context) (SchedulerCandidate, bool) {
	if !SchedulerEnforcedForRequest(c) {
		return SchedulerCandidate{}, false
	}
	candidates, ok := common.GetContextKeyType[[]SchedulerCandidate](c, constant.ContextKeySchedulerCandidates)
	if !ok || len(candidates) == 0 {
		return SchedulerCandidate{}, false
	}
	candidate := candidates[0]
	applySchedulerCandidateContext(c, candidate)
	return candidate, true
}

// SchedulerCandidateForRetry is intentionally inert unless Enforced is
// explicitly selected. It only selects metadata already obtained by Shadow;
// Reservation re-acquisition per retry is a separate gate.
func SchedulerCandidateForRetry(c *gin.Context, retry int) (SchedulerCandidate, bool) {
	if !SchedulerEnforcedForRequest(c) || retry < 0 {
		return SchedulerCandidate{}, false
	}
	candidates, ok := common.GetContextKeyType[[]SchedulerCandidate](c, constant.ContextKeySchedulerCandidates)
	if !ok || retry >= len(candidates) {
		return SchedulerCandidate{}, false
	}
	candidate := candidates[retry]
	applySchedulerCandidateContext(c, candidate)
	return candidate, true
}

func SchedulerEndpointForChannel(c *gin.Context, channelID int) string {
	candidates, ok := common.GetContextKeyType[[]SchedulerCandidate](c, constant.ContextKeySchedulerCandidates)
	if !ok {
		return ""
	}
	for _, candidate := range candidates {
		if candidate.ChannelID == channelID {
			return candidate.EndpointID
		}
	}
	// In Shadow the native route may intentionally differ; release the
	// Scheduler reservation bound to the first candidate in that case.
	if len(candidates) > 0 {
		return candidates[0].EndpointID
	}
	return ""
}

func ReserveSchedulerCandidate(c *gin.Context, candidate SchedulerCandidate, attemptNo int) error {
	config := SchedulerClient()
	if !SchedulerEnforcedForRequest(c) || attemptNo < 2 {
		return nil
	}
	if candidate.EndpointID == "" {
		return fmt.Errorf("scheduler candidate endpoint is empty")
	}
	if len(config.URLs()) == 0 || config.Token == "" {
		return nil
	}
	estimatedTokens := common.GetContextKeyInt(c, constant.ContextKeySchedulerEstimatedTokens)
	if estimatedTokens <= 0 {
		estimatedTokens = common.GetContextKeyInt(c, constant.ContextKeyEstimatedTokens)
	}
	body := schedulerReserveRequest{RequestID: c.GetString(common.RequestIdKey), DecisionID: common.GetContextKeyString(c, constant.ContextKeySchedulerDecisionID), AttemptNo: attemptNo, EndpointID: candidate.EndpointID, EstimatedTokens: estimatedTokens}
	payload, err := common.Marshal(body)
	if err != nil {
		return err
	}
	outcome, err := schedulerDoRequestWithFallback(c.Request.Context(), config, http.MethodPost, "/v1/reserve", payload, true)
	if err != nil {
		return err
	}
	if outcome.err != nil {
		return outcome.err
	}
	if outcome.status < 200 || outcome.status >= 300 {
		return fmt.Errorf("scheduler reserve status %d", outcome.status)
	}
	var reservation struct {
		ReservationID string `json:"reservation_id"`
	}
	if err := common.DecodeJson(bytes.NewReader(outcome.body), &reservation); err != nil {
		return err
	}
	if reservation.ReservationID == "" {
		return fmt.Errorf("scheduler reserve returned no reservation")
	}
	common.SetContextKey(c, constant.ContextKeySchedulerReservationID, reservation.ReservationID)
	return nil
}

// ResizeSchedulerReservation updates the first-attempt estimate after Relay
// has computed canonical prompt tokens. It is enforced-only: Shadow keeps the
// original best-effort reservation and records the canonical estimate solely
// for Attempt telemetry.
func ResizeSchedulerReservation(c *gin.Context, estimatedTokens int) error {
	config := SchedulerClient()
	if !SchedulerEnforcedForRequest(c) || len(config.URLs()) == 0 || config.Token == "" {
		return nil
	}
	if estimatedTokens < 0 {
		estimatedTokens = 0
	}
	if initialEstimate := common.GetContextKeyInt(c, constant.ContextKeySchedulerEstimatedTokens); initialEstimate == estimatedTokens {
		return nil
	}
	decisionID := common.GetContextKeyString(c, constant.ContextKeySchedulerDecisionID)
	reservationID := common.GetContextKeyString(c, constant.ContextKeySchedulerReservationID)
	if decisionID == "" || reservationID == "" {
		return nil
	}
	candidates, ok := common.GetContextKeyType[[]SchedulerCandidate](c, constant.ContextKeySchedulerCandidates)
	if !ok || len(candidates) == 0 {
		return fmt.Errorf("scheduler resize candidates are empty")
	}
	// Schedule reserves the first candidate. Distributor may have selected a
	// different native channel before Relay consumes the enforced chain, so do
	// not derive this identity from the current ChannelID.
	endpointID := candidates[0].EndpointID
	if endpointID == "" {
		return fmt.Errorf("scheduler resize endpoint is empty")
	}
	body := schedulerResizeRequest{RequestID: c.GetString(common.RequestIdKey), DecisionID: decisionID, AttemptNo: 1, EndpointID: endpointID, ReservationID: reservationID, EstimatedTokens: estimatedTokens}
	payload, err := common.Marshal(body)
	if err != nil {
		return err
	}
	outcome, err := schedulerDoRequestWithFallback(context.Background(), config, http.MethodPost, "/v1/resize", payload, true)
	if err != nil {
		return err
	}
	if outcome.err != nil {
		return outcome.err
	}
	if outcome.status < 200 || outcome.status >= 300 {
		return fmt.Errorf("scheduler resize status %d", outcome.status)
	}
	common.SetContextKey(c, constant.ContextKeySchedulerEstimatedTokens, estimatedTokens)
	return nil
}

// SchedulerReservationResizeRequired reports whether the selected channel has
// a finite TPM gate. With unlimited TPM there is nothing for resize to change,
// so Enforced requests avoid a second Scheduler round trip entirely.
func SchedulerReservationResizeRequired(c *gin.Context) bool {
	if c == nil || !SchedulerEnforcedForRequest(c) {
		return false
	}
	channelID := common.GetContextKeyInt(c, constant.ContextKeyChannelId)
	if channelID <= 0 {
		return true
	}
	channel, err := model.CacheGetChannel(channelID)
	if err != nil || channel == nil {
		return true
	}
	return channel.TPM > 0
}

// RunSchedulerShadow is best-effort by design: errors never alter native
// channel selection. A successful response is stored only as request metadata;
// Enforced candidate consumption is a separate, explicitly gated phase.
func schedulerEffectivePolicy(c *gin.Context, modelName string) (map[string]any, error) {
	// Default to the balanced routing policy so a request always carries a valid
	// mode even when the user has no routing preference configured. User-level
	// preferences, when present, override these platform defaults field by field.
	policy := map[string]any{
		"mode":            schedulerDefaultMode,
		"allow_fallbacks": true,
		"max_attempts":    3,
	}
	setting, ok := common.GetContextKeyType[dto.UserSetting](c, constant.ContextKeyUserSetting)
	if !ok || len(setting.RoutingPreferences) == 0 {
		return policy, nil
	}
	pref, ok := setting.RoutingPreferences[modelName]
	if !ok {
		pref, ok = setting.RoutingPreferences["*"]
	}
	if !ok {
		return policy, nil
	}
	if mode := strings.ToLower(strings.TrimSpace(pref.Mode)); mode != "" {
		policy["mode"] = mode
	}
	if pref.AllowFallbacks != nil {
		policy["allow_fallbacks"] = *pref.AllowFallbacks
	}
	if pref.MaxAttempts > 0 {
		policy["max_attempts"] = pref.MaxAttempts
	}
	if pref.MaxPrice > 0 {
		policy["max_price"] = pref.MaxPrice
	}
	if pref.MinQualityScore > 0 {
		policy["min_quality_score"] = pref.MinQualityScore
	}
	if len(pref.ProviderOrder) > 0 {
		policy["provider_order"] = pref.ProviderOrder
	}
	if len(pref.ProviderOnly) > 0 {
		policy["provider_only"] = pref.ProviderOnly
	}
	if len(pref.ProviderIgnore) > 0 {
		policy["provider_ignore"] = pref.ProviderIgnore
	}
	if len(pref.PreferredRegions) > 0 {
		policy["preferred_regions"] = pref.PreferredRegions
	}
	if pref.DataPolicy != "" {
		policy["data_policy"] = pref.DataPolicy
	}
	if pref.PreferenceVersion != "" {
		policy["preference_version"] = pref.PreferenceVersion
	}
	return policy, nil
}

func RunSchedulerShadow(c *gin.Context, modelName, group string) error {
	if SchedulerKillSwitchActive() {
		return nil
	}
	config := SchedulerClient()
	if !config.Enabled || len(config.URLs()) == 0 || config.Token == "" {
		return nil
	}
	if !schedulerCircuitAllows(time.Now()) {
		return ErrSchedulerTemporarilyUnavailable
	}
	if config.Timeout <= 0 {
		config.Timeout = 100 * time.Millisecond
	}
	policy, err := schedulerEffectivePolicy(c, modelName)
	if err != nil {
		return err
	}
	policy["runtime_high_watermark"] = config.RuntimeHighWatermark
	requestID := c.GetString(common.RequestIdKey)
	if requestID == "" {
		requestID = common.NewRequestId()
		c.Set(common.RequestIdKey, requestID)
	}
	estimatedInput := common.GetContextKeyInt(c, constant.ContextKeyEstimatedTokens)
	maxOutput := schedulerMaxOutputTokens(c)
	body := schedulerRequest{RequestID: requestID, UserID: int64(c.GetInt("id")), TokenID: int64(c.GetInt("token_id")), Group: group, Model: modelName, Workload: common.GetContextKeyString(c, constant.ContextKeySchedulerWorkload), Capabilities: schedulerCapabilities(c), Policy: policy, EstimatedInputTokens: estimatedInput, MaxOutputTokens: maxOutput, PreferredChannelID: common.GetContextKeyInt(c, constant.ContextKeySchedulerAffinityChannelID)}
	if affinity, ok := GetChannelAffinityStatsContext(c); ok {
		body.AffinityKeyFingerprint = affinity.KeyFingerprint
	}
	if allowed, ok := common.GetContextKeyType[[]int](c, constant.ContextKeySchedulerAllowedChannelIDs); ok {
		body.AllowedChannelIDs = append([]int(nil), allowed...)
	}
	payload, err := common.Marshal(body)
	if err != nil {
		return err
	}
	outcome, err := schedulerDoRequestWithFallback(c.Request.Context(), config, http.MethodPost, "/v1/schedule", payload, true)
	if err != nil {
		return err
	}
	if outcome.err != nil {
		if outcome.status == http.StatusBadGateway || outcome.status == http.StatusServiceUnavailable || outcome.status == http.StatusGatewayTimeout {
			return fmt.Errorf("%w: %v", ErrSchedulerTemporarilyUnavailable, outcome.err)
		}
		return outcome.err
	}
	var scheduled schedulerResponse
	if err := common.DecodeJson(bytes.NewReader(outcome.body), &scheduled); err != nil {
		return err
	}
	if scheduled.DecisionID == "" || scheduled.CatalogVersion == "" || len(scheduled.Candidates) == 0 {
		return fmt.Errorf("scheduler returned incomplete response")
	}
	seen := make(map[string]struct{}, len(scheduled.Candidates))
	for _, candidate := range scheduled.Candidates {
		if candidate.EndpointID == "" || candidate.ChannelID < 0 || candidate.KeyIndex < 0 || candidate.Model == "" || len(candidate.Reason) == 0 {
			return fmt.Errorf("scheduler returned invalid candidate")
		}
		if _, exists := seen[candidate.EndpointID]; exists {
			return fmt.Errorf("scheduler returned duplicate candidate")
		}
		seen[candidate.EndpointID] = struct{}{}
	}
	common.SetContextKey(c, constant.ContextKeySchedulerCandidates, scheduled.Candidates)
	common.SetContextKey(c, constant.ContextKeySchedulerDecisionID, scheduled.DecisionID)
	common.SetContextKey(c, constant.ContextKeySchedulerScoreVersion, scheduled.ScoreVersion)
	preferenceVersion := scheduled.PreferenceVersion
	if preferenceVersion == "" {
		preferenceVersion, _ = policy["preference_version"].(string)
	}
	common.SetContextKey(c, constant.ContextKeySchedulerPreferenceVersion, preferenceVersion)
	if preferenceVersion, ok := policy["preference_version"].(string); ok {
		common.SetContextKey(c, constant.ContextKeySchedulerPreferenceVersion, preferenceVersion)
	}
	if scheduled.Reservation != nil {
		common.SetContextKey(c, constant.ContextKeySchedulerReservationID, scheduled.Reservation.ReservationID)
		if scheduled.Reservation.EstimatedTokens > 0 {
			common.SetContextKey(c, constant.ContextKeySchedulerEstimatedTokens, scheduled.Reservation.EstimatedTokens)
		}
	}
	match := false
	for _, candidate := range scheduled.Candidates {
		if candidate.ChannelID == common.GetContextKeyInt(c, constant.ContextKeyChannelId) {
			match = true
			break
		}
	}
	common.SetContextKey(c, constant.ContextKeySchedulerShadowMatch, match)
	schedulerCircuitSuccess(time.Now())
	return nil
}

// schedulerCapabilities reads only the small capability envelope from the
// already cached request body. The body is rewound on every path so Relay
// handlers see the exact same payload. Non-JSON or unavailable bodies simply
// retain conservative defaults.
func schedulerCapabilities(c *gin.Context) map[string]any {
	capabilities := map[string]any{"stream": false, "tools": false, "json_mode": false, "vision": false}
	if c == nil || c.Request == nil {
		return capabilities
	}
	storage, err := common.GetBodyStorage(c)
	if err != nil || storage == nil {
		return capabilities
	}
	if _, err := storage.Seek(0, io.SeekStart); err != nil {
		return capabilities
	}
	var shape schedulerRequestShape
	err = common.DecodeJson(storage, &shape)
	_, _ = storage.Seek(0, io.SeekStart)
	if err != nil {
		return capabilities
	}
	capabilities["stream"] = shape.Stream
	capabilities["tools"] = len(shape.Tools) > 0 && string(shape.Tools) != "null" && string(shape.Tools) != "[]"
	if shape.ResponseFormat != nil {
		capabilities["json_mode"] = shape.ResponseFormat.Type == "json_object" || shape.ResponseFormat.Type == "json_schema"
	}
	return capabilities
}

func schedulerMaxOutputTokens(c *gin.Context) int {
	if c == nil || c.Request == nil {
		return 0
	}
	storage, err := common.GetBodyStorage(c)
	if err != nil || storage == nil {
		return 0
	}
	if _, err := storage.Seek(0, io.SeekStart); err != nil {
		return 0
	}
	var shape schedulerRequestShape
	err = common.DecodeJson(storage, &shape)
	_, _ = storage.Seek(0, io.SeekStart)
	if err != nil {
		return 0
	}
	if shape.MaxCompletionTokens > 0 {
		return shape.MaxCompletionTokens
	}
	return shape.MaxTokens
}

// SchedulerMaxOutputTokens exposes the request's output cap to the Relay
// controller when it corrects the first Reservation estimate.
func SchedulerMaxOutputTokens(c *gin.Context) int {
	return schedulerMaxOutputTokens(c)
}

// ReportSchedulerShadowAttempt releases the Scheduler reservation without
// affecting the response path. It is best-effort and should be called after
// c.Next() so the final HTTP status is available.
func ReportSchedulerShadowAttempt(c *gin.Context) error {
	config := SchedulerClient()
	if !config.Enabled || len(config.URLs()) == 0 || config.Token == "" {
		return nil
	}
	decisionID := common.GetContextKeyString(c, constant.ContextKeySchedulerDecisionID)
	if decisionID == "" {
		return nil
	}
	candidates, ok := common.GetContextKeyType[[]SchedulerCandidate](c, constant.ContextKeySchedulerCandidates)
	if !ok || len(candidates) == 0 {
		return nil
	}
	// Shadow reserves only the first Scheduler candidate. The native channel
	// may intentionally differ, but the Attempt identity must still match the
	// Reservation endpoint so capacity settlement and audit reconciliation do
	// not commit one Endpoint while reporting another.
	endpoint := candidates[0]
	requestID := c.GetString(common.RequestIdKey)
	reservationID := common.GetContextKeyString(c, constant.ContextKeySchedulerReservationID)
	status := c.Writer.Status()
	if status == 0 {
		status = http.StatusOK
	}
	start := common.GetContextKeyTime(c, constant.ContextKeyRequestStartTime)
	latency := int64(0)
	if !start.IsZero() {
		latency = time.Since(start).Milliseconds()
	}
	inputTokens := common.GetContextKeyInt(c, constant.ContextKeySchedulerInputTokens)
	outputTokens := common.GetContextKeyInt(c, constant.ContextKeySchedulerOutputTokens)
	usageUnverified := common.GetContextKeyBool(c, constant.ContextKeySchedulerUsageUnverified)
	if !usageUnverified && inputTokens == 0 && outputTokens == 0 && status >= 200 && status < 400 {
		usageUnverified = true
	}
	attempt := schedulerAttempt{
		RequestID: requestID, DecisionID: decisionID, AttemptNo: 1,
		EndpointID: endpoint.EndpointID, ReservationID: reservationID,
		StatusCode: status, Success: status >= 200 && status < 400,
		StreamStarted:   common.GetContextKeyBool(c, constant.ContextKeySchedulerStreamStarted),
		LatencyMS:       latency,
		TTFTMS:          int64(common.GetContextKeyInt(c, constant.ContextKeySchedulerTTFTMS)),
		InputTokens:     inputTokens,
		OutputTokens:    outputTokens,
		EstimatedTokens: schedulerEstimatedTokens(c),
		UsageUnverified: usageUnverified,
	}
	return postSchedulerAttempt(c, config, attempt)
}

func ReportSchedulerAttempt(c *gin.Context, endpointID string, attemptNo, statusCode int, success, streamStarted bool, inputTokens, outputTokens int) error {
	config := SchedulerClient()
	// Shadow and non-selected Canary requests are settled by
	// ReportSchedulerShadowAttempt, which reports the reserved first candidate
	// rather than the native channel.
	if !SchedulerEnforcedForRequest(c) || !config.Enabled || len(config.URLs()) == 0 || config.Token == "" {
		return nil
	}
	decisionID := common.GetContextKeyString(c, constant.ContextKeySchedulerDecisionID)
	if decisionID == "" || endpointID == "" {
		return nil
	}
	if config.Timeout <= 0 {
		config.Timeout = 100 * time.Millisecond
	}
	if statusCode == 0 {
		statusCode = http.StatusOK
	}
	start := common.GetContextKeyTime(c, constant.ContextKeyRequestStartTime)
	latency := int64(0)
	if !start.IsZero() {
		latency = time.Since(start).Milliseconds()
	}
	usageUnverified := common.GetContextKeyBool(c, constant.ContextKeySchedulerUsageUnverified)
	if !usageUnverified && inputTokens == 0 && outputTokens == 0 && (success || streamStarted) {
		usageUnverified = true
	}
	attempt := schedulerAttempt{RequestID: c.GetString(common.RequestIdKey), DecisionID: decisionID, AttemptNo: attemptNo, EndpointID: endpointID, ReservationID: common.GetContextKeyString(c, constant.ContextKeySchedulerReservationID), StatusCode: statusCode, Success: success, StreamStarted: streamStarted, LatencyMS: latency, TTFTMS: int64(common.GetContextKeyInt(c, constant.ContextKeySchedulerTTFTMS)), InputTokens: inputTokens, OutputTokens: outputTokens, EstimatedTokens: schedulerEstimatedTokens(c), UsageUnverified: usageUnverified}
	err := postSchedulerAttempt(c, config, attempt)
	if err == nil {
		common.SetContextKey(c, constant.ContextKeySchedulerAttemptReported, true)
	}
	return err
}

// ReportSchedulerAttemptAsync queues an Enforced attempt report so upstream
// response completion does not wait on Scheduler I/O. Queue saturation is
// intentionally best-effort: routing correctness is already decided, while
// the bounded queue prevents goroutine growth during a Scheduler outage.
func ReportSchedulerAttemptAsync(c *gin.Context, endpointID string, attemptNo, statusCode int, success, streamStarted bool, inputTokens, outputTokens int) error {
	config := SchedulerClient()
	if !SchedulerEnforcedForRequest(c) || !config.Enabled || len(config.URLs()) == 0 || config.Token == "" {
		return nil
	}
	decisionID := common.GetContextKeyString(c, constant.ContextKeySchedulerDecisionID)
	if decisionID == "" || endpointID == "" {
		return nil
	}
	if config.Timeout <= 0 {
		config.Timeout = 100 * time.Millisecond
	}
	if statusCode == 0 {
		statusCode = http.StatusOK
	}
	usageUnverified := common.GetContextKeyBool(c, constant.ContextKeySchedulerUsageUnverified)
	if !usageUnverified && inputTokens == 0 && outputTokens == 0 && (success || streamStarted) {
		usageUnverified = true
	}
	attempt := schedulerAttempt{RequestID: c.GetString(common.RequestIdKey), DecisionID: decisionID, AttemptNo: attemptNo, EndpointID: endpointID, ReservationID: common.GetContextKeyString(c, constant.ContextKeySchedulerReservationID), StatusCode: statusCode, Success: success, StreamStarted: streamStarted, LatencyMS: schedulerAttemptLatencyMS(c), TTFTMS: int64(common.GetContextKeyInt(c, constant.ContextKeySchedulerTTFTMS)), InputTokens: inputTokens, OutputTokens: outputTokens, EstimatedTokens: schedulerEstimatedTokens(c), UsageUnverified: usageUnverified}
	if err := enqueueSchedulerAttempt(config, attempt); err != nil {
		return err
	}
	common.SetContextKey(c, constant.ContextKeySchedulerAttemptReported, true)
	return nil
}

func schedulerAttemptLatencyMS(c *gin.Context) int64 {
	start := common.GetContextKeyTime(c, constant.ContextKeyRequestStartTime)
	if start.IsZero() {
		return 0
	}
	return time.Since(start).Milliseconds()
}

func enqueueSchedulerAttempt(config SchedulerClientConfig, attempt schedulerAttempt) error {
	select {
	case schedulerAttemptAsyncSlots <- struct{}{}:
		go func() {
			defer func() { <-schedulerAttemptAsyncSlots }()
			if err := postSchedulerAttempt(nil, config, attempt); err != nil {
				common.SysLog(fmt.Sprintf("scheduler async attempt report failed: %v", err))
			}
		}()
		return nil
	default:
		// Preserve the lifecycle event under sustained pressure. The normal path
		// is asynchronous; this bounded fallback avoids silently losing attempt
		// diagnostics while preventing unbounded goroutine creation.
		return postSchedulerAttempt(nil, config, attempt)
	}
}

func schedulerEstimatedTokens(c *gin.Context) int {
	if c == nil {
		return 0
	}
	if estimate := common.GetContextKeyInt(c, constant.ContextKeySchedulerEstimatedTokens); estimate > 0 {
		return estimate
	}
	return common.GetContextKeyInt(c, constant.ContextKeyEstimatedTokens)
}

func postSchedulerAttempt(c *gin.Context, config SchedulerClientConfig, attempt schedulerAttempt) error {
	payload, err := common.Marshal(attempt)
	if err != nil {
		return err
	}
	// Attempt reporting happens after Relay may have completed or after the
	// client has disconnected. Do not inherit the request context here: its
	// cancellation must not strand the Scheduler Reservation. The bounded
	// background context keeps this best-effort side effect independent while
	// still enforcing the client timeout.
	outcome, err := schedulerDoRequestWithFallback(context.Background(), config, http.MethodPost, "/v1/attempt", payload, true)
	if err != nil {
		return err
	}
	if outcome.err != nil {
		return outcome.err
	}
	if outcome.status < 200 || outcome.status >= 300 {
		return fmt.Errorf("scheduler attempt status %d", outcome.status)
	}
	return nil
}

func signSchedulerRequest(req *http.Request, secret string, payload []byte) {
	if req == nil || strings.TrimSpace(secret) == "" {
		return
	}
	timestamp := strconv.FormatInt(time.Now().Unix(), 10)
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write([]byte(req.Method))
	_, _ = mac.Write([]byte("\n"))
	_, _ = mac.Write([]byte(req.URL.Path))
	_, _ = mac.Write([]byte("\n"))
	_, _ = mac.Write([]byte(timestamp))
	_, _ = mac.Write([]byte("\n"))
	_, _ = mac.Write(payload)
	req.Header.Set("X-Scheduler-Timestamp", timestamp)
	req.Header.Set("X-Scheduler-Signature", hex.EncodeToString(mac.Sum(nil)))
}

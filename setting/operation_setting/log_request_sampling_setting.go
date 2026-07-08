package operation_setting

import (
	"math"
	"reflect"
	"strings"
	"sync"
	"sync/atomic"

	"github.com/QuantumNous/new-api/setting/config"
)

const (
	DefaultLogRequestSamplingRate           = 0.001
	DefaultLogRequestSamplingMaxBodyBytes   = int64(16 * 1024)
	DefaultLogRequestSamplingMaxStringBytes = 4096
	DefaultLogRequestSamplingMaxJSONDepth   = 16
	MaxLogRequestSamplingBodyBytes          = int64(64 * 1024)
	MaxLogRequestSamplingMaxStringBytes     = 16 * 1024
	MaxLogRequestSamplingMaxJSONDepth       = 32
)

type LogRequestSamplingSetting struct {
	Enabled                 bool     `json:"enabled"`
	SampleRate              float64  `json:"sample_rate"`
	Groups                  []string `json:"groups"`
	EligiblePaths           []string `json:"eligible_paths"`
	MaxBodyBytes            int64    `json:"max_body_bytes"`
	MaxStringBytes          int      `json:"max_string_bytes"`
	MaxJSONDepth            int      `json:"max_json_depth"`
	DropBinaryPayloads      bool     `json:"drop_binary_payloads"`
	AllowTextContentStorage bool     `json:"allow_text_content_storage"`
}

type LogRequestSamplingSnapshot struct {
	Enabled                 bool
	SampleRate              float64
	Groups                  map[string]bool
	EligiblePaths           []string
	EligibleExactPaths      map[string]struct{}
	EligiblePathPrefixes    []string
	MaxBodyBytes            int64
	MaxStringBytes          int
	MaxJSONDepth            int
	DropBinaryPayloads      bool
	AllowTextContentStorage bool
}

type LogRequestSamplingRuntimeSnapshot struct {
	snapshot *LogRequestSamplingSnapshot
}

func (s LogRequestSamplingRuntimeSnapshot) Enabled() bool {
	if s.snapshot == nil {
		return false
	}
	return s.snapshot.Enabled
}

func (s LogRequestSamplingRuntimeSnapshot) SampleRate() float64 {
	if s.snapshot == nil {
		return 0
	}
	return s.snapshot.SampleRate
}

func (s LogRequestSamplingRuntimeSnapshot) MaxBodyBytes() int64 {
	if s.snapshot == nil {
		return 0
	}
	return s.snapshot.MaxBodyBytes
}

func (s LogRequestSamplingRuntimeSnapshot) MaxStringBytes() int {
	if s.snapshot == nil {
		return 0
	}
	return s.snapshot.MaxStringBytes
}

func (s LogRequestSamplingRuntimeSnapshot) MaxJSONDepth() int {
	if s.snapshot == nil {
		return 0
	}
	return s.snapshot.MaxJSONDepth
}

func (s LogRequestSamplingRuntimeSnapshot) DropBinaryPayloads() bool {
	if s.snapshot == nil {
		return false
	}
	return s.snapshot.DropBinaryPayloads
}

func (s LogRequestSamplingRuntimeSnapshot) AllowTextContentStorage() bool {
	if s.snapshot == nil {
		return false
	}
	return s.snapshot.AllowTextContentStorage
}

func (s LogRequestSamplingRuntimeSnapshot) GroupEnabled(group string) bool {
	if s.snapshot == nil {
		return false
	}
	return s.snapshot.Groups[group]
}

func (s LogRequestSamplingRuntimeSnapshot) IsEligiblePath(path string) bool {
	if s.snapshot == nil {
		return false
	}
	if _, ok := s.snapshot.EligibleExactPaths[path]; ok {
		return true
	}
	for _, prefix := range s.snapshot.EligiblePathPrefixes {
		if strings.HasPrefix(path, prefix) {
			return true
		}
	}
	return false
}

var defaultLogRequestSamplingSetting = LogRequestSamplingSetting{
	Enabled:                 false,
	SampleRate:              DefaultLogRequestSamplingRate,
	Groups:                  []string{"plg"},
	EligiblePaths:           []string{"/v1/completions", "/v1/chat/completions", "/v1/responses", "/v1/responses/compact", "/v1/messages", "/v1/models/*", "/v1beta/models/*"},
	MaxBodyBytes:            DefaultLogRequestSamplingMaxBodyBytes,
	MaxStringBytes:          DefaultLogRequestSamplingMaxStringBytes,
	MaxJSONDepth:            DefaultLogRequestSamplingMaxJSONDepth,
	DropBinaryPayloads:      true,
	AllowTextContentStorage: false,
}

var (
	logRequestSamplingSetting = cloneLogRequestSamplingSetting(defaultLogRequestSamplingSetting)
	logRequestSamplingValue   atomic.Value
	logRequestSamplingMu      sync.Mutex
)

func init() {
	config.GlobalConfig.Register("log_request_sampling", &logRequestSamplingSetting)
	config.GlobalConfig.RegisterUpdateLock("log_request_sampling", &logRequestSamplingMu)
	config.GlobalConfig.RegisterUpdateHook("log_request_sampling", RefreshLogRequestSamplingSnapshot)
	RefreshLogRequestSamplingSnapshot()
}

func GetLogRequestSamplingSetting() LogRequestSamplingSetting {
	logRequestSamplingMu.Lock()
	defer logRequestSamplingMu.Unlock()
	return cloneLogRequestSamplingSetting(logRequestSamplingSetting)
}

func UpdateLogRequestSamplingSetting(update func(*LogRequestSamplingSetting)) {
	if update == nil {
		return
	}

	for {
		logRequestSamplingMu.Lock()
		base := cloneLogRequestSamplingSetting(logRequestSamplingSetting)
		logRequestSamplingMu.Unlock()

		draft := cloneLogRequestSamplingSetting(base)
		update(&draft)

		logRequestSamplingMu.Lock()
		if logRequestSamplingSettingsEqual(logRequestSamplingSetting, base) {
			logRequestSamplingSetting = cloneLogRequestSamplingSetting(draft)
			storeLogRequestSamplingSnapshotLocked()
			logRequestSamplingMu.Unlock()
			return
		}
		logRequestSamplingMu.Unlock()
	}
}

func UpdateLogRequestSamplingConfigFromMap(configMap map[string]string) error {
	logRequestSamplingMu.Lock()
	defer logRequestSamplingMu.Unlock()
	if err := config.UpdateConfigFromMap(&logRequestSamplingSetting, configMap); err != nil {
		return err
	}
	storeLogRequestSamplingSnapshotLocked()
	return nil
}

func IsLogRequestSamplingEnabled() bool {
	v := logRequestSamplingValue.Load()
	if v == nil {
		RefreshLogRequestSamplingSnapshot()
		v = logRequestSamplingValue.Load()
	}
	snapshot := v.(*LogRequestSamplingSnapshot)
	return snapshot.Enabled
}

func GetLogRequestSamplingSnapshot() LogRequestSamplingSnapshot {
	if v := logRequestSamplingValue.Load(); v != nil {
		return cloneLogRequestSamplingSnapshot(*v.(*LogRequestSamplingSnapshot))
	}
	RefreshLogRequestSamplingSnapshot()
	return cloneLogRequestSamplingSnapshot(*logRequestSamplingValue.Load().(*LogRequestSamplingSnapshot))
}

func GetLogRequestSamplingRuntimeSnapshot() LogRequestSamplingRuntimeSnapshot {
	if v := logRequestSamplingValue.Load(); v != nil {
		return LogRequestSamplingRuntimeSnapshot{snapshot: v.(*LogRequestSamplingSnapshot)}
	}
	RefreshLogRequestSamplingSnapshot()
	return LogRequestSamplingRuntimeSnapshot{snapshot: logRequestSamplingValue.Load().(*LogRequestSamplingSnapshot)}
}

func RefreshLogRequestSamplingSnapshot() {
	logRequestSamplingMu.Lock()
	defer logRequestSamplingMu.Unlock()
	storeLogRequestSamplingSnapshotLocked()
}

func storeLogRequestSamplingSnapshotLocked() {
	snapshot := buildLogRequestSamplingSnapshot(logRequestSamplingSetting)
	logRequestSamplingValue.Store(&snapshot)
}

func logRequestSamplingSettingsEqual(a LogRequestSamplingSetting, b LogRequestSamplingSetting) bool {
	return a.Enabled == b.Enabled &&
		float64ConfigEqual(a.SampleRate, b.SampleRate) &&
		reflect.DeepEqual(a.Groups, b.Groups) &&
		reflect.DeepEqual(a.EligiblePaths, b.EligiblePaths) &&
		a.MaxBodyBytes == b.MaxBodyBytes &&
		a.MaxStringBytes == b.MaxStringBytes &&
		a.MaxJSONDepth == b.MaxJSONDepth &&
		a.DropBinaryPayloads == b.DropBinaryPayloads &&
		a.AllowTextContentStorage == b.AllowTextContentStorage
}

func float64ConfigEqual(a float64, b float64) bool {
	return a == b || (math.IsNaN(a) && math.IsNaN(b))
}

func cloneLogRequestSamplingSetting(in LogRequestSamplingSetting) LogRequestSamplingSetting {
	out := in
	if in.Groups != nil {
		out.Groups = append([]string{}, in.Groups...)
	}
	if in.EligiblePaths != nil {
		out.EligiblePaths = append([]string{}, in.EligiblePaths...)
	}
	return out
}

func cloneLogRequestSamplingSnapshot(in LogRequestSamplingSnapshot) LogRequestSamplingSnapshot {
	out := in
	if in.Groups != nil {
		out.Groups = make(map[string]bool, len(in.Groups))
		for k, v := range in.Groups {
			out.Groups[k] = v
		}
	}
	out.EligiblePaths = append([]string(nil), in.EligiblePaths...)
	if in.EligibleExactPaths != nil {
		out.EligibleExactPaths = make(map[string]struct{}, len(in.EligibleExactPaths))
		for k, v := range in.EligibleExactPaths {
			out.EligibleExactPaths[k] = v
		}
	}
	out.EligiblePathPrefixes = append([]string(nil), in.EligiblePathPrefixes...)
	return out
}

func buildLogRequestSamplingSnapshot(setting LogRequestSamplingSetting) LogRequestSamplingSnapshot {
	sampleRate := setting.SampleRate
	if math.IsNaN(sampleRate) || math.IsInf(sampleRate, 0) {
		sampleRate = DefaultLogRequestSamplingRate
	}
	if sampleRate < 0 {
		sampleRate = 0
	}
	if sampleRate > 1 {
		sampleRate = 1
	}

	maxBodyBytes := setting.MaxBodyBytes
	if maxBodyBytes <= 0 {
		maxBodyBytes = DefaultLogRequestSamplingMaxBodyBytes
	}
	if maxBodyBytes > MaxLogRequestSamplingBodyBytes {
		maxBodyBytes = MaxLogRequestSamplingBodyBytes
	}
	maxStringBytes := setting.MaxStringBytes
	if maxStringBytes <= 0 {
		maxStringBytes = DefaultLogRequestSamplingMaxStringBytes
	}
	if maxStringBytes > MaxLogRequestSamplingMaxStringBytes {
		maxStringBytes = MaxLogRequestSamplingMaxStringBytes
	}
	maxJSONDepth := setting.MaxJSONDepth
	if maxJSONDepth <= 0 {
		maxJSONDepth = DefaultLogRequestSamplingMaxJSONDepth
	}
	if maxJSONDepth > MaxLogRequestSamplingMaxJSONDepth {
		maxJSONDepth = MaxLogRequestSamplingMaxJSONDepth
	}
	groups := make(map[string]bool)
	for _, group := range setting.Groups {
		group = strings.TrimSpace(group)
		if group != "" {
			groups[group] = true
		}
	}
	if len(groups) == 0 && setting.Groups == nil {
		groups["plg"] = true
	}

	eligiblePaths := make([]string, 0, len(setting.EligiblePaths))
	exactPaths := make(map[string]struct{})
	prefixes := make([]string, 0)
	for _, path := range setting.EligiblePaths {
		path = strings.TrimSpace(path)
		if path == "" {
			continue
		}
		eligiblePaths = append(eligiblePaths, path)
		if strings.HasSuffix(path, "/*") {
			prefixes = append(prefixes, strings.TrimSuffix(path, "*"))
			continue
		}
		exactPaths[path] = struct{}{}
	}
	if len(eligiblePaths) == 0 && setting.EligiblePaths == nil {
		eligiblePaths = append([]string(nil), defaultLogRequestSamplingSetting.EligiblePaths...)
		for _, path := range eligiblePaths {
			if strings.HasSuffix(path, "/*") {
				prefixes = append(prefixes, strings.TrimSuffix(path, "*"))
			} else {
				exactPaths[path] = struct{}{}
			}
		}
	}

	return LogRequestSamplingSnapshot{
		Enabled:                 setting.Enabled,
		SampleRate:              sampleRate,
		Groups:                  groups,
		EligiblePaths:           eligiblePaths,
		EligibleExactPaths:      exactPaths,
		EligiblePathPrefixes:    prefixes,
		MaxBodyBytes:            maxBodyBytes,
		MaxStringBytes:          maxStringBytes,
		MaxJSONDepth:            maxJSONDepth,
		DropBinaryPayloads:      setting.DropBinaryPayloads,
		AllowTextContentStorage: setting.AllowTextContentStorage,
	}
}

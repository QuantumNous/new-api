package operation_setting

import (
	"math"
	"reflect"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/setting/config"
)

func TestDefaultLogRequestSamplingSetting(t *testing.T) {
	resetLogRequestSamplingSettingForTest(t)

	setting := GetLogRequestSamplingSetting()
	if setting.Enabled {
		t.Fatal("expected log request sampling to be disabled by default")
	}
	if setting.SampleRate != 0.001 {
		t.Fatalf("sample rate = %v, want 0.001", setting.SampleRate)
	}
	if !reflect.DeepEqual(setting.Groups, []string{"plg"}) {
		t.Fatalf("groups = %v, want [plg]", setting.Groups)
	}
	if setting.MaxBodyBytes != 16384 {
		t.Fatalf("max body bytes = %d, want 16384", setting.MaxBodyBytes)
	}
	if setting.MaxStringBytes != 4096 {
		t.Fatalf("max string bytes = %d, want 4096", setting.MaxStringBytes)
	}
	if setting.MaxJSONDepth != 16 {
		t.Fatalf("max json depth = %d, want 16", setting.MaxJSONDepth)
	}
	if !setting.DropBinaryPayloads {
		t.Fatal("expected binary payloads to be dropped by default")
	}
	if setting.AllowTextContentStorage {
		t.Fatal("expected text content storage to be disabled by default")
	}

	wantPaths := []string{"/v1/completions", "/v1/chat/completions", "/v1/responses", "/v1/responses/compact", "/v1/messages", "/v1/models/*", "/v1beta/models/*"}
	if !reflect.DeepEqual(setting.EligiblePaths, wantPaths) {
		t.Fatalf("eligible paths = %v, want %v", setting.EligiblePaths, wantPaths)
	}
}

func TestLogRequestSamplingSnapshotIsImmutableAndValidated(t *testing.T) {
	resetLogRequestSamplingSettingForTest(t)
	err := UpdateLogRequestSamplingConfigFromMap(map[string]string{
		"enabled":          "true",
		"sample_rate":      "2",
		"groups":           `[" plg ","enterprise",""]`,
		"eligible_paths":   `["/v1/chat/completions","/v1beta/models/*",""]`,
		"max_body_bytes":   "0",
		"max_string_bytes": "0",
		"max_json_depth":   "0",
	})
	if err != nil {
		t.Fatalf("UpdateConfigFromMap failed: %v", err)
	}

	snapshot := GetLogRequestSamplingSnapshot()
	if !snapshot.Enabled {
		t.Fatal("expected snapshot enabled")
	}
	if snapshot.SampleRate != 1 {
		t.Fatalf("sample rate = %v, want clamped 1", snapshot.SampleRate)
	}
	if !snapshot.Groups["plg"] || !snapshot.Groups["enterprise"] || len(snapshot.Groups) != 2 {
		t.Fatalf("groups snapshot = %v, want plg and enterprise only", snapshot.Groups)
	}
	if snapshot.MaxBodyBytes != 16384 {
		t.Fatalf("max body bytes = %d, want default fallback", snapshot.MaxBodyBytes)
	}
	if snapshot.MaxStringBytes != 4096 {
		t.Fatalf("max string bytes = %d, want default fallback", snapshot.MaxStringBytes)
	}
	if snapshot.MaxJSONDepth != 16 {
		t.Fatalf("max json depth = %d, want default fallback", snapshot.MaxJSONDepth)
	}
	snapshot.Groups["plg"] = false
	again := GetLogRequestSamplingSnapshot()
	if !again.Groups["plg"] {
		t.Fatal("mutating returned snapshot must not affect future snapshots")
	}
}

func TestLogRequestSamplingSnapshotRejectsNonFiniteRateAndClampsLimits(t *testing.T) {
	resetLogRequestSamplingSettingForTest(t)
	UpdateLogRequestSamplingSetting(func(setting *LogRequestSamplingSetting) {
		setting.Enabled = true
		setting.SampleRate = math.Inf(1)
		setting.MaxBodyBytes = MaxLogRequestSamplingBodyBytes + 1
		setting.MaxStringBytes = MaxLogRequestSamplingMaxStringBytes + 1
		setting.MaxJSONDepth = MaxLogRequestSamplingMaxJSONDepth + 1
	})
	snapshot := GetLogRequestSamplingSnapshot()
	if snapshot.SampleRate != DefaultLogRequestSamplingRate {
		t.Fatalf("sample rate = %v, want default fallback", snapshot.SampleRate)
	}
	if snapshot.MaxBodyBytes != MaxLogRequestSamplingBodyBytes {
		t.Fatalf("max body bytes = %d, want cap %d", snapshot.MaxBodyBytes, MaxLogRequestSamplingBodyBytes)
	}
	if snapshot.MaxStringBytes != MaxLogRequestSamplingMaxStringBytes {
		t.Fatalf("max string bytes = %d, want cap %d", snapshot.MaxStringBytes, MaxLogRequestSamplingMaxStringBytes)
	}
	if snapshot.MaxJSONDepth != MaxLogRequestSamplingMaxJSONDepth {
		t.Fatalf("max json depth = %d, want cap %d", snapshot.MaxJSONDepth, MaxLogRequestSamplingMaxJSONDepth)
	}
	if err := UpdateLogRequestSamplingConfigFromMap(map[string]string{"sample_rate": "NaN"}); err != nil {
		t.Fatalf("UpdateLogRequestSamplingConfigFromMap failed: %v", err)
	}
	snapshot = GetLogRequestSamplingSnapshot()
	if snapshot.SampleRate != DefaultLogRequestSamplingRate {
		t.Fatalf("NaN sample rate = %v, want default fallback", snapshot.SampleRate)
	}
}

func TestLogRequestSamplingExplicitEmptyScopeDoesNotFallbackToDefaults(t *testing.T) {
	resetLogRequestSamplingSettingForTest(t)
	err := UpdateLogRequestSamplingConfigFromMap(map[string]string{
		"groups":         `[]`,
		"eligible_paths": `[]`,
	})
	if err != nil {
		t.Fatalf("UpdateConfigFromMap failed: %v", err)
	}

	snapshot := GetLogRequestSamplingSnapshot()
	if len(snapshot.Groups) != 0 {
		t.Fatalf("groups = %v, want explicit empty", snapshot.Groups)
	}
	if len(snapshot.EligiblePaths) != 0 {
		t.Fatalf("eligible paths = %v, want explicit empty", snapshot.EligiblePaths)
	}
	if len(snapshot.EligibleExactPaths) != 0 {
		t.Fatalf("eligible exact paths = %v, want explicit empty", snapshot.EligibleExactPaths)
	}
	if len(snapshot.EligiblePathPrefixes) != 0 {
		t.Fatalf("eligible path prefixes = %v, want explicit empty", snapshot.EligiblePathPrefixes)
	}

	runtime := GetLogRequestSamplingRuntimeSnapshot()
	if runtime.GroupEnabled("plg") {
		t.Fatal("explicit empty groups must not match default plg")
	}
	if runtime.IsEligiblePath("/v1/chat/completions") {
		t.Fatal("explicit empty eligible paths must not match default paths")
	}
}

func TestLogRequestSamplingGlobalConfigLoadRefreshesSnapshot(t *testing.T) {
	resetLogRequestSamplingSettingForTest(t)
	err := config.GlobalConfig.LoadFromDB(map[string]string{
		"log_request_sampling.enabled":     "true",
		"log_request_sampling.sample_rate": "0.5",
	})
	if err != nil {
		t.Fatalf("LoadFromDB failed: %v", err)
	}

	snapshot := GetLogRequestSamplingSnapshot()
	if !snapshot.Enabled {
		t.Fatal("expected GlobalConfig.LoadFromDB to enable snapshot")
	}
	if snapshot.SampleRate != 0.5 {
		t.Fatalf("sample rate = %v, want 0.5", snapshot.SampleRate)
	}
}

func TestUpdateLogRequestSamplingSettingAllowsReentrantReads(t *testing.T) {
	resetLogRequestSamplingSettingForTest(t)

	done := make(chan struct{})
	go func() {
		UpdateLogRequestSamplingSetting(func(setting *LogRequestSamplingSetting) {
			_ = GetLogRequestSamplingSetting()
			setting.Enabled = true
		})
		close(done)
	}()

	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("UpdateLogRequestSamplingSetting deadlocked when update callback read the setting")
	}

	if !GetLogRequestSamplingSnapshot().Enabled {
		t.Fatal("expected setting update to be applied")
	}
}

func TestUpdateLogRequestSamplingSettingDoesNotOverwriteConcurrentFieldChanges(t *testing.T) {
	resetLogRequestSamplingSettingForTest(t)

	updateStarted := make(chan struct{})
	allowUpdate := make(chan struct{})
	updateDone := make(chan struct{})
	go func() {
		UpdateLogRequestSamplingSetting(func(setting *LogRequestSamplingSetting) {
			close(updateStarted)
			<-allowUpdate
			setting.Enabled = true
		})
		close(updateDone)
	}()

	select {
	case <-updateStarted:
	case <-time.After(time.Second):
		t.Fatal("first update did not start")
	}

	UpdateLogRequestSamplingSetting(func(setting *LogRequestSamplingSetting) {
		setting.Groups = []string{"enterprise"}
	})
	close(allowUpdate)

	select {
	case <-updateDone:
	case <-time.After(time.Second):
		t.Fatal("first update did not finish")
	}

	setting := GetLogRequestSamplingSetting()
	if !setting.Enabled {
		t.Fatal("expected first update to enable sampling")
	}
	if !reflect.DeepEqual(setting.Groups, []string{"enterprise"}) {
		t.Fatalf("groups = %v, want concurrent enterprise update to be preserved", setting.Groups)
	}
}

func resetLogRequestSamplingSettingForTest(t *testing.T) {
	t.Helper()
	original := GetLogRequestSamplingSetting()
	UpdateLogRequestSamplingSetting(func(setting *LogRequestSamplingSetting) {
		*setting = cloneLogRequestSamplingSetting(defaultLogRequestSamplingSetting)
	})
	t.Cleanup(func() {
		UpdateLogRequestSamplingSetting(func(setting *LogRequestSamplingSetting) {
			*setting = original
		})
	})
}

package config

import (
	"strings"
	"sync"
	"testing"
	"time"
)

type testConfigWithMap struct {
	Modes map[string]string `json:"modes"`
	Exprs map[string]string `json:"exprs"`
	Name  string            `json:"name"`
}

type panicJSONField struct{}

func (panicJSONField) MarshalJSON() ([]byte, error) {
	panic("panic json field")
}

func (*panicJSONField) UnmarshalJSON(_ []byte) error {
	panic("panic json field")
}

type nestedJSONConfig struct {
	Value string `json:"value"`
}

type testConfigWithJSONFields struct {
	Ptr    *nestedJSONConfig `json:"ptr"`
	Modes  map[string]string `json:"modes"`
	Items  []string          `json:"items"`
	Nested nestedJSONConfig  `json:"nested"`
	Name   string            `json:"name"`
}

func TestUpdateConfigFromMap_MapReplacement(t *testing.T) {
	cfg := &testConfigWithMap{
		Modes: map[string]string{
			"model-a": "tiered_expr",
			"model-b": "tiered_expr",
		},
		Exprs: map[string]string{
			"model-a": "p * 5 + c * 25",
			"model-b": "p * 10 + c * 50",
		},
		Name: "billing",
	}

	// Simulate removing model-a: new value only has model-b
	err := UpdateConfigFromMap(cfg, map[string]string{
		"modes": `{"model-b": "tiered_expr"}`,
		"exprs": `{"model-b": "p * 10 + c * 50"}`,
	})
	if err != nil {
		t.Fatalf("UpdateConfigFromMap failed: %v", err)
	}

	if _, ok := cfg.Modes["model-a"]; ok {
		t.Errorf("Modes still contains model-a after it was removed from the update; got %v", cfg.Modes)
	}
	if _, ok := cfg.Exprs["model-a"]; ok {
		t.Errorf("Exprs still contains model-a after it was removed from the update; got %v", cfg.Exprs)
	}

	if cfg.Modes["model-b"] != "tiered_expr" {
		t.Errorf("Modes[model-b] = %q, want %q", cfg.Modes["model-b"], "tiered_expr")
	}
	if cfg.Exprs["model-b"] != "p * 10 + c * 50" {
		t.Errorf("Exprs[model-b] = %q, want %q", cfg.Exprs["model-b"], "p * 10 + c * 50")
	}
}

func TestUpdateConfigFromMap_InvalidJSONReturnsErrorAndPreservesField(t *testing.T) {
	tests := []struct {
		name      string
		fieldName string
		configMap map[string]string
		assert    func(*testing.T, *testConfigWithJSONFields)
	}{
		{
			name:      "ptr",
			fieldName: "ptr",
			configMap: map[string]string{"ptr": `{"value":`},
			assert: func(t *testing.T, cfg *testConfigWithJSONFields) {
				t.Helper()
				if cfg.Ptr == nil || cfg.Ptr.Value != "old-ptr" {
					t.Fatalf("ptr = %#v, want old value preserved", cfg.Ptr)
				}
			},
		},
		{
			name:      "map",
			fieldName: "modes",
			configMap: map[string]string{"modes": `{"a":`},
			assert: func(t *testing.T, cfg *testConfigWithJSONFields) {
				t.Helper()
				if cfg.Modes["old"] != "mode" || len(cfg.Modes) != 1 {
					t.Fatalf("modes = %v, want old map preserved", cfg.Modes)
				}
			},
		},
		{
			name:      "slice",
			fieldName: "items",
			configMap: map[string]string{"items": `["new"`},
			assert: func(t *testing.T, cfg *testConfigWithJSONFields) {
				t.Helper()
				if len(cfg.Items) != 1 || cfg.Items[0] != "old-item" {
					t.Fatalf("items = %v, want old slice preserved", cfg.Items)
				}
			},
		},
		{
			name:      "struct",
			fieldName: "nested",
			configMap: map[string]string{"nested": `{"value":`},
			assert: func(t *testing.T, cfg *testConfigWithJSONFields) {
				t.Helper()
				if cfg.Nested.Value != "old-nested" {
					t.Fatalf("nested = %#v, want old value preserved", cfg.Nested)
				}
			},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			cfg := &testConfigWithJSONFields{
				Ptr:    &nestedJSONConfig{Value: "old-ptr"},
				Modes:  map[string]string{"old": "mode"},
				Items:  []string{"old-item"},
				Nested: nestedJSONConfig{Value: "old-nested"},
				Name:   "old-name",
			}

			err := UpdateConfigFromMap(cfg, test.configMap)
			if err == nil {
				t.Fatal("expected invalid JSON to return an error")
			}
			if !strings.Contains(err.Error(), test.fieldName) {
				t.Fatalf("error = %q, want field name %q", err.Error(), test.fieldName)
			}
			test.assert(t, cfg)
		})
	}
}

func TestUpdateConfigFromMap_InvalidJSONDoesNotAllocateNilPointer(t *testing.T) {
	cfg := &testConfigWithJSONFields{}

	err := UpdateConfigFromMap(cfg, map[string]string{
		"ptr": `{"value":`,
	})
	if err == nil {
		t.Fatal("expected invalid JSON to return an error")
	}
	if cfg.Ptr != nil {
		t.Fatalf("ptr = %#v, want nil pointer preserved", cfg.Ptr)
	}
}

func TestUpdateConfigFromMap_InvalidJSONPreventsPartialUpdate(t *testing.T) {
	cfg := &testConfigWithJSONFields{
		Ptr:    &nestedJSONConfig{Value: "old-ptr"},
		Modes:  map[string]string{"old": "mode"},
		Items:  []string{"old-item"},
		Nested: nestedJSONConfig{Value: "old-nested"},
		Name:   "old-name",
	}

	err := UpdateConfigFromMap(cfg, map[string]string{
		"name":  "new-name",
		"items": `["new"`,
	})
	if err == nil {
		t.Fatal("expected invalid JSON to return an error")
	}
	if cfg.Name != "old-name" {
		t.Fatalf("name = %q, want old-name after failed update", cfg.Name)
	}
	if len(cfg.Items) != 1 || cfg.Items[0] != "old-item" {
		t.Fatalf("items = %v, want old value preserved", cfg.Items)
	}
}

func TestUpdateConfigFromMap_PointerFieldPreservesIdentity(t *testing.T) {
	cfg := &testConfigWithJSONFields{
		Ptr: &nestedJSONConfig{Value: "old-ptr"},
	}
	originalPtr := cfg.Ptr

	err := UpdateConfigFromMap(cfg, map[string]string{
		"ptr": `{"value":"new-ptr"}`,
	})
	if err != nil {
		t.Fatalf("UpdateConfigFromMap failed: %v", err)
	}
	if cfg.Ptr != originalPtr {
		t.Fatal("non-nil pointer config field must preserve pointer identity")
	}
	if cfg.Ptr.Value != "new-ptr" {
		t.Fatalf("ptr value = %q, want new-ptr", cfg.Ptr.Value)
	}

	err = UpdateConfigFromMap(cfg, map[string]string{
		"ptr": `{"value":`,
	})
	if err == nil {
		t.Fatal("expected invalid JSON to return an error")
	}
	if cfg.Ptr != originalPtr {
		t.Fatal("failed pointer config update must preserve pointer identity")
	}
	if cfg.Ptr.Value != "new-ptr" {
		t.Fatalf("ptr value = %q, want previous value preserved", cfg.Ptr.Value)
	}
}

func TestUpdateConfigFromMap_EmptyMapClearsAll(t *testing.T) {
	cfg := &testConfigWithMap{
		Modes: map[string]string{
			"model-a": "tiered_expr",
		},
		Exprs: map[string]string{
			"model-a": "p * 5 + c * 25",
		},
	}

	err := UpdateConfigFromMap(cfg, map[string]string{
		"modes": `{}`,
		"exprs": `{}`,
	})
	if err != nil {
		t.Fatalf("UpdateConfigFromMap failed: %v", err)
	}

	if len(cfg.Modes) != 0 {
		t.Errorf("Modes should be empty after updating with {}, got %v", cfg.Modes)
	}
	if len(cfg.Exprs) != 0 {
		t.Errorf("Exprs should be empty after updating with {}, got %v", cfg.Exprs)
	}
}

func TestUpdateConfigFromMap_ScalarFieldsUnchanged(t *testing.T) {
	cfg := &testConfigWithMap{
		Modes: map[string]string{"m": "v"},
		Name:  "old",
	}

	err := UpdateConfigFromMap(cfg, map[string]string{
		"name": "new",
	})
	if err != nil {
		t.Fatalf("UpdateConfigFromMap failed: %v", err)
	}

	if cfg.Name != "new" {
		t.Errorf("Name = %q, want %q", cfg.Name, "new")
	}
	// modes was not in configMap, should remain unchanged
	if cfg.Modes["m"] != "v" {
		t.Errorf("Modes should be unchanged, got %v", cfg.Modes)
	}
}

func TestConfigManagerLoadFromDBRunsUpdateHook(t *testing.T) {
	type hookConfig struct {
		Enabled bool `json:"enabled"`
	}
	manager := NewConfigManager()
	cfg := &hookConfig{}
	hookCalls := 0
	manager.Register("hook_config", cfg)
	manager.RegisterUpdateHook("hook_config", func() {
		hookCalls++
	})

	err := manager.LoadFromDB(map[string]string{
		"hook_config.enabled": "true",
	})
	if err != nil {
		t.Fatalf("LoadFromDB failed: %v", err)
	}
	if !cfg.Enabled {
		t.Fatal("expected config to be updated")
	}
	if hookCalls != 1 {
		t.Fatalf("hook calls = %d, want 1", hookCalls)
	}
}

func TestConfigManagerLoadFromDBSkipsUpdateHookOnInvalidJSON(t *testing.T) {
	type hookConfig struct {
		Groups []string `json:"groups"`
	}
	manager := NewConfigManager()
	cfg := &hookConfig{Groups: []string{"old"}}
	hookCalls := 0
	manager.Register("hook_config", cfg)
	manager.RegisterUpdateHook("hook_config", func() {
		hookCalls++
	})

	err := manager.LoadFromDB(map[string]string{
		"hook_config.groups": `["new"`,
	})
	if err != nil {
		t.Fatalf("LoadFromDB failed: %v", err)
	}
	if hookCalls != 0 {
		t.Fatalf("hook calls = %d, want 0 after invalid JSON", hookCalls)
	}
	if len(cfg.Groups) != 1 || cfg.Groups[0] != "old" {
		t.Fatalf("groups = %v, want old value preserved", cfg.Groups)
	}
}

func TestConfigManagerLoadFromDBIsolatesUpdateHookPanic(t *testing.T) {
	type hookConfig struct {
		Enabled bool `json:"enabled"`
	}
	manager := NewConfigManager()
	cfgA := &hookConfig{}
	cfgB := &hookConfig{}
	hookBCalls := 0
	manager.Register("hook_config_a", cfgA)
	manager.Register("hook_config_b", cfgB)
	manager.RegisterUpdateHook("hook_config_a", func() {
		panic("boom")
	})
	manager.RegisterUpdateHook("hook_config_b", func() {
		hookBCalls++
	})

	err := manager.LoadFromDB(map[string]string{
		"hook_config_a.enabled": "true",
		"hook_config_b.enabled": "true",
	})
	if err != nil {
		t.Fatalf("LoadFromDB failed: %v", err)
	}
	if !cfgA.Enabled || !cfgB.Enabled {
		t.Fatal("expected both configs to be updated")
	}
	if hookBCalls != 1 {
		t.Fatalf("hook B calls = %d, want 1", hookBCalls)
	}
}

func TestConfigManagerRegisterProvidesDefaultModuleLock(t *testing.T) {
	type lockConfig struct {
		Enabled bool `json:"enabled"`
	}
	manager := NewConfigManager()
	manager.Register("lock_config", &lockConfig{})

	modules := manager.moduleSnapshots()
	if len(modules) != 1 {
		t.Fatalf("modules len = %d, want 1", len(modules))
	}
	if modules[0].lock == nil {
		t.Fatal("registered config module must have a default module lock")
	}

	manager.RegisterUpdateLock("lock_config", nil)
	modules = manager.moduleSnapshots()
	if modules[0].lock == nil {
		t.Fatal("nil RegisterUpdateLock must restore a default module lock")
	}
}

func TestConfigManagerLoadFromDBReleasesLocksOnPanic(t *testing.T) {
	type panicConfig struct {
		Field panicJSONField `json:"field"`
	}
	manager := NewConfigManager()
	cfg := &panicConfig{}
	var moduleLock sync.Mutex
	manager.Register("panic_config", cfg)
	manager.RegisterUpdateLock("panic_config", &moduleLock)

	func() {
		defer func() {
			if r := recover(); r == nil {
				t.Fatal("expected LoadFromDB to panic on config JSON update")
			}
		}()
		_ = manager.LoadFromDB(map[string]string{
			"panic_config.field": `{}`,
		})
	}()

	done := make(chan struct{})
	go func() {
		_ = manager.Get("panic_config")
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("ConfigManager mutex was not released after panic")
	}

	if !moduleLock.TryLock() {
		t.Fatal("module config lock was not released after panic")
	}
	moduleLock.Unlock()
}

func TestConfigManagerLoadFromDBDoesNotHoldGlobalLockWhileWaitingForModuleLock(t *testing.T) {
	type lockConfig struct {
		Enabled bool `json:"enabled"`
	}
	manager := NewConfigManager()
	cfg := &lockConfig{}
	var moduleLock sync.Mutex
	manager.Register("lock_config", cfg)
	manager.RegisterUpdateLock("lock_config", &moduleLock)

	moduleLock.Lock()
	unlocked := false
	defer func() {
		if !unlocked {
			moduleLock.Unlock()
		}
	}()

	loadDone := make(chan struct{})
	go func() {
		_ = manager.LoadFromDB(map[string]string{
			"lock_config.enabled": "true",
		})
		close(loadDone)
	}()
	time.Sleep(50 * time.Millisecond)

	getDone := make(chan struct{})
	go func() {
		_ = manager.Get("lock_config")
		close(getDone)
	}()

	select {
	case <-getDone:
	case <-time.After(time.Second):
		t.Fatal("LoadFromDB held ConfigManager global lock while waiting for module lock")
	}

	moduleLock.Unlock()
	unlocked = true
	select {
	case <-loadDone:
	case <-time.After(time.Second):
		t.Fatal("LoadFromDB did not finish after module lock was released")
	}
	if !cfg.Enabled {
		t.Fatal("expected config update to be applied")
	}
}

func TestConfigManagerSaveToDBDoesNotHoldGlobalLockWhileWaitingForModuleLock(t *testing.T) {
	type lockConfig struct {
		Enabled bool `json:"enabled"`
	}
	manager := NewConfigManager()
	var moduleLock sync.Mutex
	manager.Register("lock_config", &lockConfig{Enabled: true})
	manager.RegisterUpdateLock("lock_config", &moduleLock)

	moduleLock.Lock()
	unlocked := false
	defer func() {
		if !unlocked {
			moduleLock.Unlock()
		}
	}()

	saveDone := make(chan struct{})
	go func() {
		_ = manager.SaveToDB(func(_, _ string) error { return nil })
		close(saveDone)
	}()
	time.Sleep(50 * time.Millisecond)

	registerDone := make(chan struct{})
	go func() {
		manager.RegisterUpdateHook("other_config", func() {})
		close(registerDone)
	}()

	select {
	case <-registerDone:
	case <-time.After(time.Second):
		t.Fatal("SaveToDB held ConfigManager global lock while waiting for module lock")
	}

	moduleLock.Unlock()
	unlocked = true
	select {
	case <-saveDone:
	case <-time.After(time.Second):
		t.Fatal("SaveToDB did not finish after module lock was released")
	}
}

func TestConfigManagerExportAllConfigsDoesNotHoldGlobalLockWhileWaitingForModuleLock(t *testing.T) {
	type lockConfig struct {
		Enabled bool `json:"enabled"`
	}
	manager := NewConfigManager()
	var moduleLock sync.Mutex
	manager.Register("lock_config", &lockConfig{Enabled: true})
	manager.RegisterUpdateLock("lock_config", &moduleLock)

	moduleLock.Lock()
	unlocked := false
	defer func() {
		if !unlocked {
			moduleLock.Unlock()
		}
	}()

	exportDone := make(chan struct{})
	go func() {
		_ = manager.ExportAllConfigs()
		close(exportDone)
	}()
	time.Sleep(50 * time.Millisecond)

	registerDone := make(chan struct{})
	go func() {
		manager.RegisterUpdateHook("other_config", func() {})
		close(registerDone)
	}()

	select {
	case <-registerDone:
	case <-time.After(time.Second):
		t.Fatal("ExportAllConfigs held ConfigManager global lock while waiting for module lock")
	}

	moduleLock.Unlock()
	unlocked = true
	select {
	case <-exportDone:
	case <-time.After(time.Second):
		t.Fatal("ExportAllConfigs did not finish after module lock was released")
	}
}

func TestConfigManagerSaveToDBReleasesModuleLockOnPanic(t *testing.T) {
	type panicConfig struct {
		Field panicJSONField `json:"field"`
	}
	manager := NewConfigManager()
	var moduleLock sync.Mutex
	manager.Register("panic_config", &panicConfig{})
	manager.RegisterUpdateLock("panic_config", &moduleLock)

	func() {
		defer func() {
			if r := recover(); r == nil {
				t.Fatal("expected SaveToDB to panic on config JSON marshal")
			}
		}()
		_ = manager.SaveToDB(func(_, _ string) error { return nil })
	}()

	if !moduleLock.TryLock() {
		t.Fatal("module config lock was not released after SaveToDB panic")
	}
	moduleLock.Unlock()
}

func TestConfigManagerExportAllConfigsReleasesModuleLockOnPanic(t *testing.T) {
	type panicConfig struct {
		Field panicJSONField `json:"field"`
	}
	manager := NewConfigManager()
	var moduleLock sync.Mutex
	manager.Register("panic_config", &panicConfig{})
	manager.RegisterUpdateLock("panic_config", &moduleLock)

	func() {
		defer func() {
			if r := recover(); r == nil {
				t.Fatal("expected ExportAllConfigs to panic on config JSON marshal")
			}
		}()
		_ = manager.ExportAllConfigs()
	}()

	if !moduleLock.TryLock() {
		t.Fatal("module config lock was not released after ExportAllConfigs panic")
	}
	moduleLock.Unlock()
}

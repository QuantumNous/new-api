package registry

import (
	"testing"

	"github.com/QuantumNous/new-api/core/interfaces"
)

// Mock Hook实现
type mockHook struct {
	name     string
	priority int
	enabled  bool
}

func (m *mockHook) Name() string { return m.name }
func (m *mockHook) Priority() int { return m.priority }
func (m *mockHook) Enabled() bool { return m.enabled }
func (m *mockHook) OnBeforeRequest(ctx *interfaces.HookContext) error { return nil }
func (m *mockHook) OnAfterResponse(ctx *interfaces.HookContext) error { return nil }
func (m *mockHook) OnError(ctx *interfaces.HookContext, err error) error { return nil }

func TestHookRegistry(t *testing.T) {
	// 创建新的注册表（用于测试）
	registry := &HookRegistry{hooks: make([]interfaces.RelayHook, 0)}
	
	// 测试注册Hook
	hook1 := &mockHook{name: "test_hook_1", priority: 100, enabled: true}
	hook2 := &mockHook{name: "test_hook_2", priority: 50, enabled: true}
	hook3 := &mockHook{name: "test_hook_3", priority: 75, enabled: false}
	
	if err := registry.Register(hook1); err != nil {
		t.Errorf("Failed to register hook1: %v", err)
	}
	
	if err := registry.Register(hook2); err != nil {
		t.Errorf("Failed to register hook2: %v", err)
	}
	
	if err := registry.Register(hook3); err != nil {
		t.Errorf("Failed to register hook3: %v", err)
	}
	
	// 测试重复注册
	if err := registry.Register(hook1); err == nil {
		t.Error("Expected error when registering duplicate hook")
	}
	
	// 测试获取Hook
	if hook, err := registry.Get("test_hook_1"); err != nil {
		t.Errorf("Failed to get hook: %v", err)
	} else if hook.Name() != "test_hook_1" {
		t.Errorf("Got wrong hook: %s", hook.Name())
	}
	
	// 测试不存在的Hook
	if _, err := registry.Get("nonexistent"); err == nil {
		t.Error("Expected error when getting nonexistent hook")
	}
	
	// 测试List（应该只返回enabled的hooks）
	hooks := registry.List()
	if len(hooks) != 2 {
		t.Errorf("Expected 2 enabled hooks, got %d", len(hooks))
	}
	
	// 测试优先级排序（100应该在50之前）
	if hooks[0].Priority() != 100 {
		t.Errorf("Expected first hook to have priority 100, got %d", hooks[0].Priority())
	}
	
	// 测试Count
	if count := registry.Count(); count != 3 {
		t.Errorf("Expected count 3, got %d", count)
	}
	
	// 测试EnabledCount
	if count := registry.EnabledCount(); count != 2 {
		t.Errorf("Expected enabled count 2, got %d", count)
	}
	
	// 测试Has
	if !registry.Has("test_hook_1") {
		t.Error("Expected to find test_hook_1")
	}
	
	if registry.Has("nonexistent") {
		t.Error("Should not find nonexistent hook")
	}
}

func TestChannelRegistry(t *testing.T) {
	// 这里可以添加Channel Registry的测试
	// 但需要mock ChannelPlugin接口，比较复杂
	// 作为示例，我们只测试基本功能
	
	registry := &ChannelRegistry{plugins: make(map[int]interfaces.ChannelPlugin)}
	
	// 测试Has方法
	if registry.Has(1) {
		t.Error("Should not find channel type 1")
	}
}

func TestMiddlewareRegistry(t *testing.T) {
	// Middleware Registry测试
	// 需要mock MiddlewarePlugin接口
	
	registry := &MiddlewareRegistry{plugins: make(map[string]interfaces.MiddlewarePlugin)}
	
	// 测试Has方法
	if registry.Has("test_middleware") {
		t.Error("Should not find test_middleware")
	}
}


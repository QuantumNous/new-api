package registry

import (
	"fmt"
	"sort"
	"sync"

	"github.com/QuantumNous/new-api/core/interfaces"
)

var (
	// 全局Hook注册表
	hookRegistry     = &HookRegistry{hooks: make([]interfaces.RelayHook, 0)}
	hookRegistryLock sync.RWMutex
)

// HookRegistry Hook插件注册中心
type HookRegistry struct {
	hooks  []interfaces.RelayHook
	sorted bool
	mu     sync.RWMutex
}

// Register 注册Hook插件
func (r *HookRegistry) Register(hook interfaces.RelayHook) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	
	// 检查是否已存在同名Hook
	for _, h := range r.hooks {
		if h.Name() == hook.Name() {
			return fmt.Errorf("hook %s already registered", hook.Name())
		}
	}
	
	r.hooks = append(r.hooks, hook)
	r.sorted = false // 标记需要重新排序
	
	return nil
}

// Get 获取指定名称的Hook插件
func (r *HookRegistry) Get(name string) (interfaces.RelayHook, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	
	for _, hook := range r.hooks {
		if hook.Name() == name {
			return hook, nil
		}
	}
	
	return nil, fmt.Errorf("hook %s not found", name)
}

// List 列出所有已注册且启用的Hook插件（按优先级排序）
func (r *HookRegistry) List() []interfaces.RelayHook {
	r.mu.Lock()
	defer r.mu.Unlock()
	
	// 如果未排序，先排序
	if !r.sorted {
		r.sortHooks()
	}
	
	// 只返回启用的hooks
	enabledHooks := make([]interfaces.RelayHook, 0)
	for _, hook := range r.hooks {
		if hook.Enabled() {
			enabledHooks = append(enabledHooks, hook)
		}
	}
	
	return enabledHooks
}

// ListAll 列出所有已注册的Hook插件（包括未启用的）
func (r *HookRegistry) ListAll() []interfaces.RelayHook {
	r.mu.RLock()
	defer r.mu.RUnlock()
	
	hooks := make([]interfaces.RelayHook, len(r.hooks))
	copy(hooks, r.hooks)
	
	return hooks
}

// sortHooks 按优先级排序hooks（优先级数字越大越先执行）
func (r *HookRegistry) sortHooks() {
	sort.SliceStable(r.hooks, func(i, j int) bool {
		return r.hooks[i].Priority() > r.hooks[j].Priority()
	})
	r.sorted = true
}

// Has 检查是否存在指定的Hook插件
func (r *HookRegistry) Has(name string) bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	
	for _, hook := range r.hooks {
		if hook.Name() == name {
			return true
		}
	}
	
	return false
}

// Count 返回已注册的Hook数量
func (r *HookRegistry) Count() int {
	r.mu.RLock()
	defer r.mu.RUnlock()
	
	return len(r.hooks)
}

// EnabledCount 返回已启用的Hook数量
func (r *HookRegistry) EnabledCount() int {
	r.mu.RLock()
	defer r.mu.RUnlock()
	
	count := 0
	for _, hook := range r.hooks {
		if hook.Enabled() {
			count++
		}
	}
	
	return count
}

// 全局函数

// RegisterHook 注册Hook插件
func RegisterHook(hook interfaces.RelayHook) error {
	hookRegistryLock.Lock()
	defer hookRegistryLock.Unlock()
	return hookRegistry.Register(hook)
}

// GetHook 获取Hook插件
func GetHook(name string) (interfaces.RelayHook, error) {
	hookRegistryLock.RLock()
	defer hookRegistryLock.RUnlock()
	return hookRegistry.Get(name)
}

// ListHooks 列出所有已启用的Hook插件
func ListHooks() []interfaces.RelayHook {
	hookRegistryLock.RLock()
	defer hookRegistryLock.RUnlock()
	return hookRegistry.List()
}

// ListAllHooks 列出所有Hook插件
func ListAllHooks() []interfaces.RelayHook {
	hookRegistryLock.RLock()
	defer hookRegistryLock.RUnlock()
	return hookRegistry.ListAll()
}

// HasHook 检查是否存在指定的Hook插件
func HasHook(name string) bool {
	hookRegistryLock.RLock()
	defer hookRegistryLock.RUnlock()
	return hookRegistry.Has(name)
}

// HookCount 返回已注册的Hook数量
func HookCount() int {
	hookRegistryLock.RLock()
	defer hookRegistryLock.RUnlock()
	return hookRegistry.Count()
}

// EnabledHookCount 返回已启用的Hook数量
func EnabledHookCount() int {
	hookRegistryLock.RLock()
	defer hookRegistryLock.RUnlock()
	return hookRegistry.EnabledCount()
}


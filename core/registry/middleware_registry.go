package registry

import (
	"fmt"
	"sort"
	"sync"

	"github.com/QuantumNous/new-api/core/interfaces"
)

var (
	// 全局Middleware注册表
	middlewareRegistry     = &MiddlewareRegistry{plugins: make(map[string]interfaces.MiddlewarePlugin)}
	middlewareRegistryLock sync.RWMutex
)

// MiddlewareRegistry 中间件插件注册中心
type MiddlewareRegistry struct {
	plugins map[string]interfaces.MiddlewarePlugin
	mu      sync.RWMutex
}

// Register 注册Middleware插件
func (r *MiddlewareRegistry) Register(plugin interfaces.MiddlewarePlugin) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	
	name := plugin.Name()
	if _, exists := r.plugins[name]; exists {
		return fmt.Errorf("middleware plugin %s already registered", name)
	}
	
	r.plugins[name] = plugin
	return nil
}

// Get 获取Middleware插件
func (r *MiddlewareRegistry) Get(name string) (interfaces.MiddlewarePlugin, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	
	plugin, exists := r.plugins[name]
	if !exists {
		return nil, fmt.Errorf("middleware plugin %s not found", name)
	}
	
	return plugin, nil
}

// List 列出所有已注册的Middleware插件（按优先级排序）
func (r *MiddlewareRegistry) List() []interfaces.MiddlewarePlugin {
	r.mu.RLock()
	defer r.mu.RUnlock()
	
	plugins := make([]interfaces.MiddlewarePlugin, 0, len(r.plugins))
	for _, plugin := range r.plugins {
		plugins = append(plugins, plugin)
	}
	
	// 按优先级排序（优先级数字越大越先执行）
	sort.SliceStable(plugins, func(i, j int) bool {
		return plugins[i].Priority() > plugins[j].Priority()
	})
	
	return plugins
}

// ListEnabled 列出所有已启用的Middleware插件（按优先级排序）
func (r *MiddlewareRegistry) ListEnabled() []interfaces.MiddlewarePlugin {
	r.mu.RLock()
	defer r.mu.RUnlock()
	
	plugins := make([]interfaces.MiddlewarePlugin, 0, len(r.plugins))
	for _, plugin := range r.plugins {
		if plugin.Enabled() {
			plugins = append(plugins, plugin)
		}
	}
	
	// 按优先级排序
	sort.SliceStable(plugins, func(i, j int) bool {
		return plugins[i].Priority() > plugins[j].Priority()
	})
	
	return plugins
}

// Has 检查是否存在指定的Middleware插件
func (r *MiddlewareRegistry) Has(name string) bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	
	_, exists := r.plugins[name]
	return exists
}

// 全局函数

// RegisterMiddleware 注册Middleware插件
func RegisterMiddleware(plugin interfaces.MiddlewarePlugin) error {
	middlewareRegistryLock.Lock()
	defer middlewareRegistryLock.Unlock()
	return middlewareRegistry.Register(plugin)
}

// GetMiddleware 获取Middleware插件
func GetMiddleware(name string) (interfaces.MiddlewarePlugin, error) {
	middlewareRegistryLock.RLock()
	defer middlewareRegistryLock.RUnlock()
	return middlewareRegistry.Get(name)
}

// ListMiddlewares 列出所有Middleware插件
func ListMiddlewares() []interfaces.MiddlewarePlugin {
	middlewareRegistryLock.RLock()
	defer middlewareRegistryLock.RUnlock()
	return middlewareRegistry.List()
}

// ListEnabledMiddlewares 列出所有已启用的Middleware插件
func ListEnabledMiddlewares() []interfaces.MiddlewarePlugin {
	middlewareRegistryLock.RLock()
	defer middlewareRegistryLock.RUnlock()
	return middlewareRegistry.ListEnabled()
}

// HasMiddleware 检查是否存在指定的Middleware插件
func HasMiddleware(name string) bool {
	middlewareRegistryLock.RLock()
	defer middlewareRegistryLock.RUnlock()
	return middlewareRegistry.Has(name)
}


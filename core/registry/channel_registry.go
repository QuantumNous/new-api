package registry

import (
	"fmt"
	"sync"

	"github.com/QuantumNous/new-api/core/interfaces"
)

var (
	// 全局Channel注册表
	channelRegistry     = &ChannelRegistry{plugins: make(map[int]interfaces.ChannelPlugin)}
	channelRegistryLock sync.RWMutex
	
	// 全局TaskChannel注册表
	taskChannelRegistry     = &TaskChannelRegistry{plugins: make(map[string]interfaces.TaskChannelPlugin)}
	taskChannelRegistryLock sync.RWMutex
)

// ChannelRegistry Channel插件注册中心
type ChannelRegistry struct {
	plugins map[int]interfaces.ChannelPlugin // channelType -> plugin
	mu      sync.RWMutex
}

// Register 注册Channel插件
func (r *ChannelRegistry) Register(channelType int, plugin interfaces.ChannelPlugin) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	
	if _, exists := r.plugins[channelType]; exists {
		return fmt.Errorf("channel plugin for type %d already registered", channelType)
	}
	
	r.plugins[channelType] = plugin
	return nil
}

// Get 获取Channel插件
func (r *ChannelRegistry) Get(channelType int) (interfaces.ChannelPlugin, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	
	plugin, exists := r.plugins[channelType]
	if !exists {
		return nil, fmt.Errorf("channel plugin for type %d not found", channelType)
	}
	
	return plugin, nil
}

// List 列出所有已注册的Channel插件
func (r *ChannelRegistry) List() []interfaces.ChannelPlugin {
	r.mu.RLock()
	defer r.mu.RUnlock()
	
	plugins := make([]interfaces.ChannelPlugin, 0, len(r.plugins))
	for _, plugin := range r.plugins {
		plugins = append(plugins, plugin)
	}
	
	return plugins
}

// Has 检查是否存在指定的Channel插件
func (r *ChannelRegistry) Has(channelType int) bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	
	_, exists := r.plugins[channelType]
	return exists
}

// TaskChannelRegistry TaskChannel插件注册中心
type TaskChannelRegistry struct {
	plugins map[string]interfaces.TaskChannelPlugin // platform -> plugin
	mu      sync.RWMutex
}

// Register 注册TaskChannel插件
func (r *TaskChannelRegistry) Register(platform string, plugin interfaces.TaskChannelPlugin) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	
	if _, exists := r.plugins[platform]; exists {
		return fmt.Errorf("task channel plugin for platform %s already registered", platform)
	}
	
	r.plugins[platform] = plugin
	return nil
}

// Get 获取TaskChannel插件
func (r *TaskChannelRegistry) Get(platform string) (interfaces.TaskChannelPlugin, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	
	plugin, exists := r.plugins[platform]
	if !exists {
		return nil, fmt.Errorf("task channel plugin for platform %s not found", platform)
	}
	
	return plugin, nil
}

// List 列出所有已注册的TaskChannel插件
func (r *TaskChannelRegistry) List() []interfaces.TaskChannelPlugin {
	r.mu.RLock()
	defer r.mu.RUnlock()
	
	plugins := make([]interfaces.TaskChannelPlugin, 0, len(r.plugins))
	for _, plugin := range r.plugins {
		plugins = append(plugins, plugin)
	}
	
	return plugins
}

// 全局函数 - Channel Registry

// RegisterChannel 注册Channel插件
func RegisterChannel(channelType int, plugin interfaces.ChannelPlugin) error {
	channelRegistryLock.Lock()
	defer channelRegistryLock.Unlock()
	return channelRegistry.Register(channelType, plugin)
}

// GetChannel 获取Channel插件
func GetChannel(channelType int) (interfaces.ChannelPlugin, error) {
	channelRegistryLock.RLock()
	defer channelRegistryLock.RUnlock()
	return channelRegistry.Get(channelType)
}

// ListChannels 列出所有Channel插件
func ListChannels() []interfaces.ChannelPlugin {
	channelRegistryLock.RLock()
	defer channelRegistryLock.RUnlock()
	return channelRegistry.List()
}

// HasChannel 检查是否存在指定的Channel插件
func HasChannel(channelType int) bool {
	channelRegistryLock.RLock()
	defer channelRegistryLock.RUnlock()
	return channelRegistry.Has(channelType)
}

// 全局函数 - TaskChannel Registry

// RegisterTaskChannel 注册TaskChannel插件
func RegisterTaskChannel(platform string, plugin interfaces.TaskChannelPlugin) error {
	taskChannelRegistryLock.Lock()
	defer taskChannelRegistryLock.Unlock()
	return taskChannelRegistry.Register(platform, plugin)
}

// GetTaskChannel 获取TaskChannel插件
func GetTaskChannel(platform string) (interfaces.TaskChannelPlugin, error) {
	taskChannelRegistryLock.RLock()
	defer taskChannelRegistryLock.RUnlock()
	return taskChannelRegistry.Get(platform)
}

// ListTaskChannels 列出所有TaskChannel插件
func ListTaskChannels() []interfaces.TaskChannelPlugin {
	taskChannelRegistryLock.RLock()
	defer taskChannelRegistryLock.RUnlock()
	return taskChannelRegistry.List()
}


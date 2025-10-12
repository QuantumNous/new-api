package hooks

import (
	"fmt"
	"sync"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/core/interfaces"
	"github.com/QuantumNous/new-api/core/registry"
)

var (
	// 全局Hook链实例（单例）
	globalChain     *HookChain
	globalChainOnce sync.Once
)

// HookChain Hook执行链
type HookChain struct {
	hooks []interfaces.RelayHook
	mu    sync.RWMutex
}

// GetGlobalChain 获取全局Hook链实例
func GetGlobalChain() *HookChain {
	globalChainOnce.Do(func() {
		globalChain = &HookChain{
			hooks: make([]interfaces.RelayHook, 0),
		}
		// 从注册中心加载hooks
		globalChain.LoadHooks()
	})
	return globalChain
}

// LoadHooks 从注册中心加载hooks
func (c *HookChain) LoadHooks() {
	c.mu.Lock()
	defer c.mu.Unlock()
	
	c.hooks = registry.ListHooks()
	common.SysLog(fmt.Sprintf("Loaded %d enabled hooks", len(c.hooks)))
}

// ReloadHooks 重新加载hooks
func (c *HookChain) ReloadHooks() {
	c.LoadHooks()
	common.SysLog("Hooks reloaded")
}

// ExecuteBeforeRequest 执行所有BeforeRequest钩子
func (c *HookChain) ExecuteBeforeRequest(ctx *interfaces.HookContext) error {
	c.mu.RLock()
	hooks := c.hooks
	c.mu.RUnlock()
	
	for _, hook := range hooks {
		if !hook.Enabled() {
			continue
		}
		
		if ctx.ShouldSkip {
			break
		}
		
		if err := hook.OnBeforeRequest(ctx); err != nil {
			common.SysError(fmt.Sprintf("Hook %s OnBeforeRequest error: %v", hook.Name(), err))
			return fmt.Errorf("hook %s failed: %w", hook.Name(), err)
		}
	}
	
	return nil
}

// ExecuteAfterResponse 执行所有AfterResponse钩子
func (c *HookChain) ExecuteAfterResponse(ctx *interfaces.HookContext) error {
	c.mu.RLock()
	hooks := c.hooks
	c.mu.RUnlock()
	
	for _, hook := range hooks {
		if !hook.Enabled() {
			continue
		}
		
		if ctx.ShouldSkip {
			break
		}
		
		if err := hook.OnAfterResponse(ctx); err != nil {
			common.SysError(fmt.Sprintf("Hook %s OnAfterResponse error: %v", hook.Name(), err))
			return fmt.Errorf("hook %s failed: %w", hook.Name(), err)
		}
	}
	
	return nil
}

// ExecuteOnError 执行所有OnError钩子
func (c *HookChain) ExecuteOnError(ctx *interfaces.HookContext, err error) error {
	c.mu.RLock()
	hooks := c.hooks
	c.mu.RUnlock()
	
	for _, hook := range hooks {
		if !hook.Enabled() {
			continue
		}
		
		if hookErr := hook.OnError(ctx, err); hookErr != nil {
			common.SysError(fmt.Sprintf("Hook %s OnError failed: %v", hook.Name(), hookErr))
			// OnError钩子的错误不会中断执行
		}
	}
	
	return err
}

// GetHooks 获取当前hook列表
func (c *HookChain) GetHooks() []interfaces.RelayHook {
	c.mu.RLock()
	defer c.mu.RUnlock()
	
	hooks := make([]interfaces.RelayHook, len(c.hooks))
	copy(hooks, c.hooks)
	return hooks
}

// Count 返回hook数量
func (c *HookChain) Count() int {
	c.mu.RLock()
	defer c.mu.RUnlock()
	
	return len(c.hooks)
}


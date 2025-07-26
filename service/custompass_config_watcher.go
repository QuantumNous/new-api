package service

import (
	"context"
	"fmt"
	"sync"
	"time"

	"one-api/common"
)

// ConfigWatcher provides hot reload functionality for CustomPass configuration
type ConfigWatcher struct {
	configService CustomPassConfigService
	ctx           context.Context
	cancel        context.CancelFunc
	wg            sync.WaitGroup
	mu            sync.RWMutex

	// Configuration
	checkInterval time.Duration
	enabled       bool

	// Callbacks
	onConfigChanged []func(*CustomPassConfig)
}

// NewConfigWatcher creates a new configuration watcher
func NewConfigWatcher(configService CustomPassConfigService) *ConfigWatcher {
	ctx, cancel := context.WithCancel(context.Background())

	return &ConfigWatcher{
		configService:   configService,
		ctx:             ctx,
		cancel:          cancel,
		checkInterval:   30 * time.Second, // Check every 30 seconds
		enabled:         true,
		onConfigChanged: make([]func(*CustomPassConfig), 0),
	}
}

// Start begins the configuration watching process
func (w *ConfigWatcher) Start() error {
	w.mu.Lock()
	defer w.mu.Unlock()

	if !w.enabled {
		return nil
	}

	w.wg.Add(1)
	go w.watchLoop()

	common.SysLog("CustomPass configuration watcher started")
	return nil
}

// Stop stops the configuration watching process
func (w *ConfigWatcher) Stop() error {
	w.mu.Lock()
	defer w.mu.Unlock()

	if w.cancel != nil {
		w.cancel()
	}

	w.wg.Wait()
	common.SysLog("CustomPass configuration watcher stopped")
	return nil
}

// AddConfigChangeCallback adds a callback function that will be called when configuration changes
func (w *ConfigWatcher) AddConfigChangeCallback(callback func(*CustomPassConfig)) {
	w.mu.Lock()
	defer w.mu.Unlock()

	w.onConfigChanged = append(w.onConfigChanged, callback)
}

// SetCheckInterval sets the interval for checking configuration changes
func (w *ConfigWatcher) SetCheckInterval(interval time.Duration) {
	w.mu.Lock()
	defer w.mu.Unlock()

	if interval < time.Second {
		interval = time.Second
	}

	w.checkInterval = interval
}

// SetEnabled enables or disables the configuration watcher
func (w *ConfigWatcher) SetEnabled(enabled bool) {
	w.mu.Lock()
	defer w.mu.Unlock()

	w.enabled = enabled
}

// ForceReload forces a configuration reload
func (w *ConfigWatcher) ForceReload() error {
	w.mu.RLock()
	defer w.mu.RUnlock()

	return w.reloadConfig()
}

// watchLoop is the main watching loop
func (w *ConfigWatcher) watchLoop() {
	defer w.wg.Done()

	ticker := time.NewTicker(w.getCheckInterval())
	defer ticker.Stop()

	for {
		select {
		case <-w.ctx.Done():
			return
		case <-ticker.C:
			if w.shouldReloadConfig() {
				if err := w.reloadConfig(); err != nil {
					common.SysError("Failed to reload CustomPass configuration: " + err.Error())
				}
			}

			// Update ticker interval if it changed
			newInterval := w.getCheckInterval()
			if newInterval != w.checkInterval {
				ticker.Stop()
				ticker = time.NewTicker(newInterval)
				w.checkInterval = newInterval
			}
		}
	}
}

// shouldReloadConfig checks if configuration should be reloaded
func (w *ConfigWatcher) shouldReloadConfig() bool {
	// Check if config service supports staleness detection
	if staleChecker, ok := w.configService.(interface{ IsConfigStale() bool }); ok {
		return staleChecker.IsConfigStale()
	}

	// Default to always reload if we can't detect staleness
	return true
}

// reloadConfig reloads the configuration and notifies callbacks
func (w *ConfigWatcher) reloadConfig() error {
	// Reload configuration
	if err := w.configService.ReloadConfig(); err != nil {
		return err
	}

	// Get the new configuration
	newConfig := w.configService.GetConfig()

	// Notify all callbacks
	callbacks := w.getCallbacks()
	for _, callback := range callbacks {
		go func(cb func(*CustomPassConfig)) {
			defer func() {
				if r := recover(); r != nil {
					common.SysError("CustomPass config change callback panicked: " + fmt.Sprintf("%v", r))
				}
			}()
			cb(newConfig)
		}(callback)
	}

	common.SysLog("CustomPass configuration reloaded successfully")
	return nil
}

// getCheckInterval returns the current check interval
func (w *ConfigWatcher) getCheckInterval() time.Duration {
	w.mu.RLock()
	defer w.mu.RUnlock()

	return w.checkInterval
}

// getCallbacks returns a copy of the callbacks slice
func (w *ConfigWatcher) getCallbacks() []func(*CustomPassConfig) {
	w.mu.RLock()
	defer w.mu.RUnlock()

	callbacks := make([]func(*CustomPassConfig), len(w.onConfigChanged))
	copy(callbacks, w.onConfigChanged)
	return callbacks
}

// ConfigHotReloadManager manages hot reload for all CustomPass components
type ConfigHotReloadManager struct {
	watcher       *ConfigWatcher
	configService CustomPassConfigService
	mu            sync.RWMutex

	// Component references for hot reload
	pollingServices []interface{ UpdateConfig(*CustomPassConfig) }
	adaptors        []interface{ UpdateConfig(*CustomPassConfig) }
	authServices    []interface{ UpdateConfig(*CustomPassConfig) }
}

// NewConfigHotReloadManager creates a new hot reload manager
func NewConfigHotReloadManager() *ConfigHotReloadManager {
	configService := NewCustomPassConfigService()
	watcher := NewConfigWatcher(configService)

	manager := &ConfigHotReloadManager{
		watcher:         watcher,
		configService:   configService,
		pollingServices: make([]interface{ UpdateConfig(*CustomPassConfig) }, 0),
		adaptors:        make([]interface{ UpdateConfig(*CustomPassConfig) }, 0),
		authServices:    make([]interface{ UpdateConfig(*CustomPassConfig) }, 0),
	}

	// Register the hot reload callback
	watcher.AddConfigChangeCallback(manager.onConfigChanged)

	return manager
}

// Start starts the hot reload manager
func (m *ConfigHotReloadManager) Start() error {
	return m.watcher.Start()
}

// Stop stops the hot reload manager
func (m *ConfigHotReloadManager) Stop() error {
	return m.watcher.Stop()
}

// RegisterPollingService registers a polling service for hot reload
func (m *ConfigHotReloadManager) RegisterPollingService(service interface{ UpdateConfig(*CustomPassConfig) }) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.pollingServices = append(m.pollingServices, service)
}

// RegisterAdaptor registers an adaptor for hot reload
func (m *ConfigHotReloadManager) RegisterAdaptor(adaptor interface{ UpdateConfig(*CustomPassConfig) }) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.adaptors = append(m.adaptors, adaptor)
}

// RegisterAuthService registers an auth service for hot reload
func (m *ConfigHotReloadManager) RegisterAuthService(service interface{ UpdateConfig(*CustomPassConfig) }) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.authServices = append(m.authServices, service)
}

// ForceReload forces a configuration reload
func (m *ConfigHotReloadManager) ForceReload() error {
	return m.watcher.ForceReload()
}

// GetConfigService returns the configuration service
func (m *ConfigHotReloadManager) GetConfigService() CustomPassConfigService {
	return m.configService
}

// onConfigChanged is called when configuration changes
func (m *ConfigHotReloadManager) onConfigChanged(newConfig *CustomPassConfig) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	// Update all registered polling services
	for _, service := range m.pollingServices {
		go func(s interface{ UpdateConfig(*CustomPassConfig) }) {
			defer func() {
				if r := recover(); r != nil {
					common.SysError("Failed to update polling service config: " + fmt.Sprintf("%v", r))
				}
			}()
			s.UpdateConfig(newConfig)
		}(service)
	}

	// Update all registered adaptors
	for _, adaptor := range m.adaptors {
		go func(a interface{ UpdateConfig(*CustomPassConfig) }) {
			defer func() {
				if r := recover(); r != nil {
					common.SysError("Failed to update adaptor config: " + fmt.Sprintf("%v", r))
				}
			}()
			a.UpdateConfig(newConfig)
		}(adaptor)
	}

	// Update all registered auth services
	for _, service := range m.authServices {
		go func(s interface{ UpdateConfig(*CustomPassConfig) }) {
			defer func() {
				if r := recover(); r != nil {
					common.SysError("Failed to update auth service config: " + fmt.Sprintf("%v", r))
				}
			}()
			s.UpdateConfig(newConfig)
		}(service)
	}

	common.SysLog("CustomPass configuration hot reload completed for all components")
}

// Global hot reload manager instance
var (
	hotReloadManager     *ConfigHotReloadManager
	hotReloadManagerOnce sync.Once
)

// GetConfigHotReloadManager returns the global hot reload manager instance
func GetConfigHotReloadManager() *ConfigHotReloadManager {
	hotReloadManagerOnce.Do(func() {
		hotReloadManager = NewConfigHotReloadManager()
	})
	return hotReloadManager
}

// InitCustomPassConfigHotReload initializes the hot reload system
func InitCustomPassConfigHotReload() error {
	manager := GetConfigHotReloadManager()
	return manager.Start()
}

// StopCustomPassConfigHotReload stops the hot reload system
func StopCustomPassConfigHotReload() error {
	if hotReloadManager != nil {
		return hotReloadManager.Stop()
	}
	return nil
}

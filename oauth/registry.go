package oauth

import (
	"fmt"
	"maps"
	"sync"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

var (
	providers = make(map[string]Provider)
	mu        sync.RWMutex
	// customProviderSlugs tracks which providers are custom (can be unregistered)
	customProviderSlugs     = make(map[string]bool)
	customProviderConflicts = make(map[string]bool)
	// customProviderLoadMu runs one full load at a time, so a load that read
	// the database earlier never replaces a later one.
	customProviderLoadMu sync.Mutex
)

// Register registers an OAuth provider with the given name
func Register(name string, provider Provider) {
	mu.Lock()
	defer mu.Unlock()
	providers[name] = provider
}

// RegisterCustom registers a custom OAuth provider (can be unregistered later)
func RegisterCustom(name string, provider Provider) error {
	mu.Lock()
	defer mu.Unlock()
	return registerCustomLocked(name, provider)
}

// registerCustomLocked registers a custom provider; the caller holds mu.
func registerCustomLocked(name string, provider Provider) error {
	if providers[name] != nil && !customProviderSlugs[name] {
		customProviderConflicts[name] = true
		return fmt.Errorf("custom OAuth provider %q conflicts with a built-in provider; rename the custom provider", name)
	}
	providers[name] = provider
	customProviderSlugs[name] = true
	return nil
}

func HasCustomProviderConflict(name string) bool {
	mu.RLock()
	defer mu.RUnlock()
	return customProviderConflicts[name]
}

// Unregister removes a provider from the registry
func Unregister(name string) {
	mu.Lock()
	defer mu.Unlock()
	delete(providers, name)
	delete(customProviderSlugs, name)
}

// GetProvider returns the OAuth provider for the given name
func GetProvider(name string) Provider {
	mu.RLock()
	defer mu.RUnlock()
	return providers[name]
}

// GetAllProviders returns all registered OAuth providers
func GetAllProviders() map[string]Provider {
	mu.RLock()
	defer mu.RUnlock()
	result := make(map[string]Provider, len(providers))
	maps.Copy(result, providers)
	return result
}

// GetEnabledCustomProviders returns all enabled custom OAuth providers
func GetEnabledCustomProviders() []*GenericOAuthProvider {
	mu.RLock()
	defer mu.RUnlock()
	var result []*GenericOAuthProvider
	for name, provider := range providers {
		if customProviderSlugs[name] {
			if gp, ok := provider.(*GenericOAuthProvider); ok && gp.IsEnabled() {
				result = append(result, gp)
			}
		}
	}
	return result
}

// IsProviderRegistered checks if a provider is registered
func IsProviderRegistered(name string) bool {
	mu.RLock()
	defer mu.RUnlock()
	_, ok := providers[name]
	return ok
}

// IsCustomProvider checks if a provider is a custom provider
func IsCustomProvider(name string) bool {
	mu.RLock()
	defer mu.RUnlock()
	return customProviderSlugs[name]
}

// LoadCustomProviders replaces the custom OAuth providers with the ones in the
// database, all at once: a login never finds a provider missing mid-load. A
// failed read keeps the current ones. A provider whose slug a built-in takes
// is skipped and logged; it does not fail the load.
func LoadCustomProviders() error {
	customProviderLoadMu.Lock()
	defer customProviderLoadMu.Unlock()
	customProviders, err := model.GetAllCustomOAuthProviders()
	if err != nil {
		common.SysError(common.LogText("Failed to load custom OAuth providers: %s", err.Error()))
		return err
	}

	mu.Lock()
	for name := range customProviderSlugs {
		delete(providers, name)
	}
	customProviderSlugs = make(map[string]bool)
	customProviderConflicts = make(map[string]bool)
	conflicts := make([]error, len(customProviders))
	for i, config := range customProviders {
		conflicts[i] = registerCustomLocked(config.Slug, NewGenericOAuthProvider(config))
	}
	mu.Unlock()

	for i, config := range customProviders {
		if conflicts[i] != nil {
			common.SysError(conflicts[i].Error())
			continue
		}
		common.SysLog(common.LogText("Loaded custom OAuth provider: %s (%s)", config.Name, config.Slug))
	}
	common.SysLog(common.LogText("Loaded %d custom OAuth providers", len(customProviders)))
	return nil
}

// ReloadCustomProviders reloads all custom OAuth providers from the database
func ReloadCustomProviders() error {
	return LoadCustomProviders()
}

// RegisterOrUpdateCustomProvider registers or updates a single custom provider
func RegisterOrUpdateCustomProvider(config *model.CustomOAuthProvider) {
	provider := NewGenericOAuthProvider(config)
	if err := RegisterCustom(config.Slug, provider); err != nil {
		common.SysError(err.Error())
	}
}

// UnregisterCustomProvider unregisters a custom provider by slug
func UnregisterCustomProvider(slug string) {
	mu.Lock()
	defer mu.Unlock()
	if customProviderSlugs[slug] {
		delete(providers, slug)
		delete(customProviderSlugs, slug)
	}
	delete(customProviderConflicts, slug)
}

package service

import (
	"fmt"
	"net"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

type CustomDomainKind string

const (
	CustomDomainKindInvalid  CustomDomainKind = "invalid"
	CustomDomainKindMain     CustomDomainKind = "main"
	CustomDomainKindApex     CustomDomainKind = "apex"
	CustomDomainKindCustom   CustomDomainKind = "custom"
	CustomDomainKindDisabled CustomDomainKind = "disabled"
	CustomDomainKindUnknown  CustomDomainKind = "unknown"
)

type CustomDomainContext struct {
	Kind        CustomDomainKind
	Host        string
	DomainID    int64
	OwnerUserID int
	Enabled     bool
}

type CustomDomainResolver struct {
	settings common.CustomDomainSettings
	mainHost string
	now      func() time.Time

	cacheMu sync.RWMutex
	cache   map[string]customDomainCacheEntry
}

type customDomainCacheEntry struct {
	context   CustomDomainContext
	expiresAt time.Time
}

const maximumCustomDomainCacheEntries = 1024

func NewCustomDomainResolver(settings common.CustomDomainSettings) (*CustomDomainResolver, error) {
	return NewCustomDomainResolverWithClock(settings, time.Now)
}

func NewCustomDomainResolverWithClock(settings common.CustomDomainSettings, now func() time.Time) (*CustomDomainResolver, error) {
	if now == nil {
		return nil, fmt.Errorf("custom domain clock is required")
	}
	normalizedMainOrigin, err := common.NormalizeOrigin(settings.MainOrigin)
	if err != nil {
		return nil, fmt.Errorf("custom domain main origin is invalid")
	}
	parsedMainOrigin, err := url.Parse(normalizedMainOrigin)
	if err != nil || parsedMainOrigin.Scheme != "https" || parsedMainOrigin.Hostname() == "" {
		return nil, fmt.Errorf("custom domain main origin is invalid")
	}

	suffix := strings.TrimSuffix(strings.ToLower(strings.TrimSpace(settings.Suffix)), ".")
	parts := strings.Split(suffix, ".")
	if len(parts) < 2 {
		return nil, fmt.Errorf("custom domain suffix is invalid")
	}
	for _, part := range parts {
		if _, err := common.NormalizeDNSLabel(part); err != nil {
			return nil, fmt.Errorf("custom domain suffix is invalid")
		}
	}
	mainHost := strings.ToLower(parsedMainOrigin.Hostname())
	if mainHost == suffix || strings.HasSuffix(mainHost, "."+suffix) {
		return nil, fmt.Errorf("custom domain suffix is invalid")
	}
	if settings.CacheTTLSeconds < 1 {
		return nil, fmt.Errorf("custom domain cache TTL is invalid")
	}
	if settings.ReservedLabels == nil {
		settings.ReservedLabels = map[string]struct{}{}
	}
	settings.Suffix = suffix
	settings.MainOrigin = normalizedMainOrigin
	return &CustomDomainResolver{
		settings: settings,
		mainHost: mainHost,
		now:      now,
		cache:    make(map[string]customDomainCacheEntry),
	}, nil
}

func (resolver *CustomDomainResolver) ResolveHost(rawHost string) (CustomDomainContext, error) {
	host, ok := normalizeCustomDomainRequestHost(rawHost)
	if !ok {
		return CustomDomainContext{Kind: CustomDomainKindInvalid}, nil
	}
	if host == resolver.mainHost {
		return CustomDomainContext{Kind: CustomDomainKindMain, Host: host}, nil
	}
	if host == resolver.settings.Suffix {
		return CustomDomainContext{Kind: CustomDomainKindApex, Host: host}, nil
	}

	suffix := "." + resolver.settings.Suffix
	if !strings.HasSuffix(host, suffix) {
		return CustomDomainContext{Kind: CustomDomainKindInvalid, Host: host}, nil
	}
	label := strings.TrimSuffix(host, suffix)
	if strings.Contains(label, ".") {
		return CustomDomainContext{Kind: CustomDomainKindInvalid, Host: host}, nil
	}
	label, err := model.NormalizeCustomDomainLabel(label, resolver.settings.ReservedLabels)
	if err != nil {
		return CustomDomainContext{Kind: CustomDomainKindInvalid, Host: host}, nil
	}
	if context, found := resolver.cachedContext(host); found {
		return context, nil
	}

	domain, err := model.GetCustomDomainByLabel(label)
	if err != nil {
		if err == model.ErrCustomDomainNotFound {
			context := CustomDomainContext{Kind: CustomDomainKindUnknown, Host: host}
			resolver.cacheContext(host, context)
			return context, nil
		}
		return CustomDomainContext{}, err
	}
	context := CustomDomainContext{
		Host:        host,
		DomainID:    domain.Id,
		OwnerUserID: domain.OwnerUserID,
		Enabled:     domain.Enabled,
	}
	if domain.Enabled {
		context.Kind = CustomDomainKindCustom
	} else {
		context.Kind = CustomDomainKindDisabled
	}
	resolver.cacheContext(host, context)
	return context, nil
}

func (resolver *CustomDomainResolver) cachedContext(host string) (CustomDomainContext, bool) {
	resolver.cacheMu.RLock()
	entry, found := resolver.cache[host]
	resolver.cacheMu.RUnlock()
	if !found || !entry.expiresAt.After(resolver.now()) {
		return CustomDomainContext{}, false
	}
	return entry.context, true
}

func (resolver *CustomDomainResolver) cacheContext(host string, context CustomDomainContext) {
	now := resolver.now()
	resolver.cacheMu.Lock()
	defer resolver.cacheMu.Unlock()
	if len(resolver.cache) >= maximumCustomDomainCacheEntries {
		for key, entry := range resolver.cache {
			if !entry.expiresAt.After(now) {
				delete(resolver.cache, key)
			}
		}
		if len(resolver.cache) >= maximumCustomDomainCacheEntries {
			return
		}
	}
	resolver.cache[host] = customDomainCacheEntry{
		context:   context,
		expiresAt: now.Add(time.Duration(resolver.settings.CacheTTLSeconds) * time.Second),
	}
}

func normalizeCustomDomainRequestHost(rawHost string) (string, bool) {
	host := strings.TrimSpace(rawHost)
	if host == "" || strings.Contains(host, ",") || strings.ContainsAny(host, "\r\n/@?#\\") {
		return "", false
	}
	if strings.Contains(host, ":") {
		parsedHost, rawPort, err := net.SplitHostPort(host)
		if err != nil || parsedHost == "" {
			return "", false
		}
		port, err := strconv.Atoi(rawPort)
		if err != nil || port < 1 || port > 65535 {
			return "", false
		}
		host = parsedHost
	}
	host = strings.TrimSuffix(strings.ToLower(host), ".")
	if host == "" || strings.Contains(host, ":") || strings.ContainsAny(host, "[]") {
		return "", false
	}
	return host, true
}

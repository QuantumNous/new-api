package service

import (
	"errors"
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
	Kind           CustomDomainKind
	Host           string
	DomainID       int64
	OwnerUserID    int
	Enabled        bool
	IsCallbackHost bool
	IsWildcardMain bool
}

type CustomDomainResolver struct {
	settings      common.CustomDomainSettings
	mainHosts     map[string]struct{}
	mainWildcards []string
	callbackHost  string
	now           func() time.Time

	cacheMu sync.RWMutex
	cache   map[string]customDomainCacheEntry
}

type customDomainCacheEntry struct {
	context   CustomDomainContext
	expiresAt time.Time
}

const maximumCustomDomainCacheEntries = 1024

// ErrCustomDomainOriginInvalid indicates that a stored Host/domain pair no
// longer matches either a configured main origin or its promotion-domain row.
var ErrCustomDomainOriginInvalid = errors.New("custom domain origin is invalid")

func NewCustomDomainResolver(settings common.CustomDomainSettings) (*CustomDomainResolver, error) {
	return NewCustomDomainResolverWithClock(settings, time.Now)
}

// NewRuntimeCustomDomainResolver builds the resolver from startup-normalized
// settings shared by middleware and callback validation.
func NewRuntimeCustomDomainResolver() (*CustomDomainResolver, error) {
	return NewCustomDomainResolver(common.CustomDomainSettings{
		Enabled:         common.CustomDomainEnabled,
		Suffix:          common.CustomDomainSuffix,
		MainOrigin:      common.CustomDomainMainOrigin,
		MainOrigins:     common.CustomDomainMainOrigins,
		CacheTTLSeconds: common.CustomDomainCacheTTLSeconds,
		ReservedLabels:  common.CustomDomainReservedLabels,
	})
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
	callbackHost := strings.ToLower(parsedMainOrigin.Hostname())
	mainOrigins := settings.MainOrigins
	if len(mainOrigins) == 0 {
		mainOrigins = []string{normalizedMainOrigin}
	}
	mainHosts := make(map[string]struct{}, len(mainOrigins))
	var mainWildcards []string
	seenOrigins := make(map[string]struct{}, len(mainOrigins))
	normalizedMainOrigins := make([]string, 0, len(mainOrigins))
	callbackFound := false
	for _, rawOrigin := range mainOrigins {
		rule, err := common.ParseCustomDomainMainOriginRule(rawOrigin, suffix)
		if err != nil {
			return nil, fmt.Errorf("custom domain main origin is invalid: %w", err)
		}
		origin := rule.Origin
		parsedOrigin, err := url.Parse(origin)
		if err != nil || parsedOrigin.Scheme != "https" || parsedOrigin.Hostname() == "" {
			return nil, fmt.Errorf("custom domain main origin is invalid")
		}
		host := strings.ToLower(parsedOrigin.Hostname())
		if host == suffix || strings.HasSuffix(host, "."+suffix) {
			return nil, fmt.Errorf("custom domain suffix is invalid")
		}
		if origin != normalizedMainOrigin && parsedOrigin.Port() != "" {
			return nil, fmt.Errorf("custom domain peer origins must use the standard https port")
		}
		if _, found := seenOrigins[host]; found {
			return nil, fmt.Errorf("custom domain main origin host is duplicated")
		}
		seenOrigins[host] = struct{}{}
		if rule.Wildcard {
			mainWildcards = append(mainWildcards, "."+rule.Host)
		} else {
			mainHosts[host] = struct{}{}
		}
		normalizedMainOrigins = append(normalizedMainOrigins, origin)
		callbackFound = callbackFound || origin == normalizedMainOrigin
	}
	if !callbackFound {
		return nil, fmt.Errorf("custom domain callback origin is not a main origin")
	}
	if settings.CacheTTLSeconds < 1 {
		return nil, fmt.Errorf("custom domain cache TTL is invalid")
	}
	if settings.ReservedLabels == nil {
		settings.ReservedLabels = map[string]struct{}{}
	}
	settings.Suffix = suffix
	settings.MainOrigin = normalizedMainOrigin
	settings.MainOrigins = normalizedMainOrigins
	return &CustomDomainResolver{
		settings:      settings,
		mainHosts:     mainHosts,
		mainWildcards: mainWildcards,
		callbackHost:  callbackHost,
		now:           now,
		cache:         make(map[string]customDomainCacheEntry),
	}, nil
}

func (resolver *CustomDomainResolver) ResolveHost(rawHost string) (CustomDomainContext, error) {
	host, ok := normalizeCustomDomainRequestHost(rawHost)
	if !ok {
		return CustomDomainContext{Kind: CustomDomainKindInvalid}, nil
	}
	if _, found := resolver.mainHosts[host]; found {
		return CustomDomainContext{
			Kind:           CustomDomainKindMain,
			Host:           host,
			IsCallbackHost: host == resolver.callbackHost,
		}, nil
	}
	if len(host) <= 253 {
		for _, suffix := range resolver.mainWildcards {
			if !strings.HasSuffix(host, suffix) {
				continue
			}
			label := strings.TrimSuffix(host, suffix)
			if normalized, err := common.NormalizeDNSLabel(label); err == nil && normalized == label {
				return CustomDomainContext{Kind: CustomDomainKindMain, Host: host, IsWildcardMain: true}, nil
			}
		}
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

// ResolveStoredOrigin verifies a persisted Host against either the peer-main
// allowlist (domainID zero) or the matching promotion-domain row.
func (resolver *CustomDomainResolver) ResolveStoredOrigin(domainID int64, rawHost string) (CustomDomainContext, error) {
	context, err := resolver.ResolveHost(rawHost)
	if err != nil {
		return CustomDomainContext{}, err
	}
	if domainID == 0 && context.Kind == CustomDomainKindMain {
		return context, nil
	}
	if domainID > 0 &&
		(context.Kind == CustomDomainKindCustom || context.Kind == CustomDomainKindDisabled) &&
		context.DomainID == domainID {
		return context, nil
	}
	return CustomDomainContext{}, ErrCustomDomainOriginInvalid
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

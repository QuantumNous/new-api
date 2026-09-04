package common

import (
	"fmt"
	"net"
	"net/url"
	"os"
	"regexp"
	"strconv"
	"strings"

	"golang.org/x/net/publicsuffix"
)

const (
	defaultCustomDomainSuffix      = "yeschoy.io"
	defaultCustomDomainMainOrigin  = "https://yeschoy.com"
	defaultCustomDomainCacheTTL    = 5
	maximumCustomDomainCacheTTL    = 60
	maximumCustomDomainMainOrigins = 32
)

var defaultCustomDomainReservedLabels = []string{
	"admin",
	"api",
	"auth",
	"callback",
	"pay",
	"www",
}

var customDomainDNSLabelPattern = regexp.MustCompile(`^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$`)

type CustomDomainSettings struct {
	Enabled         bool
	Suffix          string
	MainOrigin      string
	MainOrigins     []string
	CacheTTLSeconds int
	ReservedLabels  map[string]struct{}
}

var (
	CustomDomainEnabled         bool
	CustomDomainSuffix          = defaultCustomDomainSuffix
	CustomDomainMainOrigin      = defaultCustomDomainMainOrigin
	CustomDomainMainOrigins     = []string{defaultCustomDomainMainOrigin}
	CustomDomainCacheTTLSeconds = defaultCustomDomainCacheTTL
	CustomDomainReservedLabels  = defaultCustomDomainReservedLabelSet()
)

// NormalizeDNSLabel canonicalizes one ASCII DNS label. It intentionally does
// not apply product policy such as a reserved-name list.
func NormalizeDNSLabel(raw string) (string, error) {
	label := strings.ToLower(strings.TrimSpace(raw))
	if !customDomainDNSLabelPattern.MatchString(label) {
		return "", fmt.Errorf("invalid DNS label")
	}
	return label, nil
}

func ParseCustomDomainSettings(enabledRaw, suffixRaw, mainOriginRaw, cacheTTLRaw, reservedRaw string) (CustomDomainSettings, error) {
	return ParseCustomDomainSettingsWithMainOrigins(enabledRaw, suffixRaw, mainOriginRaw, "", cacheTTLRaw, reservedRaw)
}

// ParseCustomDomainSettingsWithMainOrigins validates the single technical
// callback Origin and the peer application Origin allowlist together.
func ParseCustomDomainSettingsWithMainOrigins(enabledRaw, suffixRaw, mainOriginRaw, mainOriginsRaw, cacheTTLRaw, reservedRaw string) (CustomDomainSettings, error) {
	enabled, err := parseCustomDomainEnabled(enabledRaw)
	if err != nil {
		return CustomDomainSettings{}, err
	}

	suffix, err := normalizeCustomDomainSuffix(suffixRaw)
	if err != nil {
		return CustomDomainSettings{}, err
	}

	mainOrigin, err := normalizeCustomDomainMainOrigin(mainOriginRaw, suffix)
	if err != nil {
		return CustomDomainSettings{}, err
	}
	mainOrigins, err := normalizeCustomDomainMainOrigins(mainOriginsRaw, mainOrigin, suffix)
	if err != nil {
		return CustomDomainSettings{}, err
	}

	cacheTTLSeconds, err := parseCustomDomainCacheTTL(cacheTTLRaw)
	if err != nil {
		return CustomDomainSettings{}, err
	}

	reservedLabels, err := parseCustomDomainReservedLabels(reservedRaw)
	if err != nil {
		return CustomDomainSettings{}, err
	}

	return CustomDomainSettings{
		Enabled:         enabled,
		Suffix:          suffix,
		MainOrigin:      mainOrigin,
		MainOrigins:     mainOrigins,
		CacheTTLSeconds: cacheTTLSeconds,
		ReservedLabels:  reservedLabels,
	}, nil
}

func InitCustomDomainSettings() error {
	settings, err := ParseCustomDomainSettingsWithMainOrigins(
		os.Getenv("CUSTOM_DOMAIN_ENABLED"),
		os.Getenv("CUSTOM_DOMAIN_SUFFIX"),
		os.Getenv("CUSTOM_DOMAIN_MAIN_ORIGIN"),
		os.Getenv("CUSTOM_DOMAIN_MAIN_ORIGINS"),
		os.Getenv("CUSTOM_DOMAIN_CACHE_TTL_SECONDS"),
		os.Getenv("CUSTOM_DOMAIN_RESERVED_LABELS"),
	)
	if err != nil {
		return err
	}
	CustomDomainEnabled = settings.Enabled
	CustomDomainSuffix = settings.Suffix
	CustomDomainMainOrigin = settings.MainOrigin
	CustomDomainMainOrigins = settings.MainOrigins
	CustomDomainCacheTTLSeconds = settings.CacheTTLSeconds
	CustomDomainReservedLabels = settings.ReservedLabels
	return nil
}

func ValidateCustomDomainHTTPSettings() error {
	return validateCustomDomainSessionSettings(CustomDomainSettings{
		Enabled:     CustomDomainEnabled,
		Suffix:      CustomDomainSuffix,
		MainOrigin:  CustomDomainMainOrigin,
		MainOrigins: CustomDomainMainOrigins,
	}, SessionCookieSecure, SessionCookieTrustedURLs)
}

func validateCustomDomainSessionSettings(settings CustomDomainSettings, secure bool, trustedOrigins []string) error {
	if !settings.Enabled {
		return nil
	}
	if !secure {
		return fmt.Errorf("CUSTOM_DOMAIN_ENABLED=true requires SESSION_COOKIE_SECURE=true")
	}
	mainOrigins := settings.MainOrigins
	if len(mainOrigins) == 0 {
		mainOrigins = []string{settings.MainOrigin}
	}
	trusted := make(map[string]struct{}, len(trustedOrigins))
	for _, origin := range trustedOrigins {
		trusted[origin] = struct{}{}
	}
	for _, mainOrigin := range mainOrigins {
		rule, err := ParseCustomDomainMainOriginRule(mainOrigin, settings.Suffix)
		if err != nil {
			return err
		}
		if rule.Wildcard {
			continue
		}
		if _, found := trusted[rule.Origin]; !found {
			return fmt.Errorf("all exact CUSTOM_DOMAIN_MAIN_ORIGINS must be included in SESSION_COOKIE_TRUSTED_URL")
		}
	}
	return nil
}

// CustomDomainMainOriginRule is either an exact Origin or a one-label wildcard.
// Host is the exact hostname or the wildcard's base, never a browser Origin.
type CustomDomainMainOriginRule struct {
	Origin   string
	Host     string
	Wildcard bool
}

// ParseCustomDomainMainOriginRule is shared by startup and runtime resolvers.
// Wildcards are routing policy only; NormalizeOrigin remains exact-only.
func ParseCustomDomainMainOriginRule(raw, promotionSuffix string) (CustomDomainMainOriginRule, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return CustomDomainMainOriginRule{}, fmt.Errorf("main origin rule is empty")
	}
	if !strings.Contains(raw, "*") {
		origin, err := normalizeCustomDomainMainOrigin(raw, promotionSuffix)
		if err != nil {
			return CustomDomainMainOriginRule{}, err
		}
		parsed, _ := url.Parse(origin)
		return CustomDomainMainOriginRule{Origin: origin, Host: parsed.Hostname()}, nil
	}
	parsed, err := url.Parse(raw)
	if err != nil || parsed.Scheme != "https" || parsed.User != nil ||
		strings.ContainsAny(raw, "?#\r\n") || (parsed.Path != "" && parsed.Path != "/") ||
		strings.Count(raw, "*") != 1 || !strings.HasPrefix(parsed.Hostname(), "*.") ||
		(parsed.Port() != "" && parsed.Port() != "443") || strings.HasSuffix(parsed.Host, ":") {
		return CustomDomainMainOriginRule{}, fmt.Errorf("wildcard main origin must be https://*.domain with the standard HTTPS port")
	}
	base := strings.TrimSuffix(strings.ToLower(strings.TrimPrefix(parsed.Hostname(), "*.")), ".")
	// Leave room for at least one concrete label and its separating dot.
	if len(base) > 251 || net.ParseIP(base) != nil {
		return CustomDomainMainOriginRule{}, fmt.Errorf("wildcard main origin base is too long or an IP address")
	}
	for _, label := range strings.Split(base, ".") {
		if normalized, err := NormalizeDNSLabel(label); err != nil || normalized != label {
			return CustomDomainMainOriginRule{}, fmt.Errorf("wildcard main origin base has an invalid DNS label")
		}
	}
	boundary, _ := publicsuffix.PublicSuffix(base)
	if base == boundary {
		return CustomDomainMainOriginRule{}, fmt.Errorf("wildcard main origin base must not be a public or private suffix")
	}
	suffix := strings.TrimSuffix(strings.ToLower(strings.TrimSpace(promotionSuffix)), ".")
	if base == suffix || strings.HasSuffix(base, "."+suffix) || strings.HasSuffix(suffix, "."+base) {
		return CustomDomainMainOriginRule{}, fmt.Errorf("wildcard main origin must not overlap CUSTOM_DOMAIN_SUFFIX")
	}
	return CustomDomainMainOriginRule{Origin: "https://*." + base, Host: base, Wildcard: true}, nil
}

func defaultCustomDomainReservedLabelSet() map[string]struct{} {
	labels := make(map[string]struct{}, len(defaultCustomDomainReservedLabels))
	for _, label := range defaultCustomDomainReservedLabels {
		labels[label] = struct{}{}
	}
	return labels
}

func parseCustomDomainEnabled(raw string) (bool, error) {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "", "false":
		return false, nil
	case "true":
		return true, nil
	default:
		return false, fmt.Errorf("CUSTOM_DOMAIN_ENABLED must be true or false")
	}
}

func normalizeCustomDomainSuffix(raw string) (string, error) {
	suffix := strings.TrimSuffix(strings.ToLower(strings.TrimSpace(raw)), ".")
	if suffix == "" {
		suffix = defaultCustomDomainSuffix
	}
	if len(suffix) > 253 {
		return "", fmt.Errorf("CUSTOM_DOMAIN_SUFFIX is too long")
	}
	parts := strings.Split(suffix, ".")
	if len(parts) < 2 {
		return "", fmt.Errorf("CUSTOM_DOMAIN_SUFFIX must contain at least two DNS labels")
	}
	for _, part := range parts {
		if _, err := NormalizeDNSLabel(part); err != nil {
			return "", fmt.Errorf("CUSTOM_DOMAIN_SUFFIX is invalid: %w", err)
		}
	}
	return suffix, nil
}

func normalizeCustomDomainMainOrigin(raw, suffix string) (string, error) {
	origin := strings.TrimSpace(raw)
	if origin == "" {
		origin = defaultCustomDomainMainOrigin
	}
	normalized, err := NormalizeOrigin(origin)
	if err != nil {
		return "", fmt.Errorf("CUSTOM_DOMAIN_MAIN_ORIGIN is invalid: %w", err)
	}
	parsed, err := url.Parse(normalized)
	if err != nil || parsed.Scheme != "https" {
		return "", fmt.Errorf("CUSTOM_DOMAIN_MAIN_ORIGIN must be an https origin")
	}
	host := strings.ToLower(parsed.Hostname())
	if host == suffix || strings.HasSuffix(host, "."+suffix) {
		return "", fmt.Errorf("CUSTOM_DOMAIN_MAIN_ORIGIN must not be inside CUSTOM_DOMAIN_SUFFIX")
	}
	return normalized, nil
}

func normalizeCustomDomainMainOrigins(raw, mainOrigin, suffix string) ([]string, error) {
	if strings.TrimSpace(raw) == "" {
		return []string{mainOrigin}, nil
	}
	parts := strings.Split(raw, ",")
	if len(parts) > maximumCustomDomainMainOrigins {
		return nil, fmt.Errorf("CUSTOM_DOMAIN_MAIN_ORIGINS supports at most %d origins", maximumCustomDomainMainOrigins)
	}
	origins := make([]string, 0, len(parts))
	originsByHost := make(map[string]string, len(parts))
	callbackFound := false
	for _, part := range parts {
		if strings.TrimSpace(part) == "" {
			return nil, fmt.Errorf("CUSTOM_DOMAIN_MAIN_ORIGINS contains an empty origin")
		}
		rule, err := ParseCustomDomainMainOriginRule(part, suffix)
		if err != nil {
			return nil, fmt.Errorf("CUSTOM_DOMAIN_MAIN_ORIGINS is invalid: %w", err)
		}
		origin := rule.Origin
		parsed, _ := url.Parse(origin)
		if origin != mainOrigin && parsed.Port() != "" {
			return nil, fmt.Errorf("CUSTOM_DOMAIN_MAIN_ORIGINS peer origins must use the standard https port")
		}
		host := strings.ToLower(parsed.Hostname())
		if existing, found := originsByHost[host]; found {
			if existing != origin {
				return nil, fmt.Errorf("CUSTOM_DOMAIN_MAIN_ORIGINS contains conflicting origins for host %s", host)
			}
			continue
		}
		originsByHost[host] = origin
		origins = append(origins, origin)
		callbackFound = callbackFound || origin == mainOrigin
	}
	if !callbackFound {
		return nil, fmt.Errorf("CUSTOM_DOMAIN_MAIN_ORIGIN must be included in CUSTOM_DOMAIN_MAIN_ORIGINS")
	}
	return origins, nil
}

func parseCustomDomainCacheTTL(raw string) (int, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return defaultCustomDomainCacheTTL, nil
	}
	ttl, err := strconv.Atoi(raw)
	if err != nil || ttl < 1 || ttl > maximumCustomDomainCacheTTL {
		return 0, fmt.Errorf("CUSTOM_DOMAIN_CACHE_TTL_SECONDS must be between 1 and %d", maximumCustomDomainCacheTTL)
	}
	return ttl, nil
}

func parseCustomDomainReservedLabels(raw string) (map[string]struct{}, error) {
	labels := defaultCustomDomainReservedLabelSet()
	for _, part := range strings.Split(raw, ",") {
		if strings.TrimSpace(part) == "" {
			continue
		}
		label, err := NormalizeDNSLabel(part)
		if err != nil {
			return nil, fmt.Errorf("CUSTOM_DOMAIN_RESERVED_LABELS is invalid: %w", err)
		}
		labels[label] = struct{}{}
	}
	return labels, nil
}

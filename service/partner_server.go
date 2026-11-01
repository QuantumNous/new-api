package service

import (
	"crypto/hmac"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"net/http"
	"net/netip"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/cachex"
	"github.com/samber/hot"
)

const (
	// PartnerServerScope is the only scope a partner server token carries. It
	// is never offered on the consent page or through authorization codes.
	PartnerServerScope          = "partner:accounts"
	PartnerServerAccessTokenTTL = time.Hour
	PartnerServerMaxIPEntries   = 64

	partnerServerSnapshotTTL      = 60 * time.Second
	partnerServerTokenCacheMaxTTL = 5 * time.Minute
	partnerServerCacheCapacity    = 10000

	// Audit reasons for refused partner server authentication.
	PartnerServerReasonInvalidSecret = "invalid_secret"
	PartnerServerReasonIPNotAllowed  = "ip_not_allowed"
	PartnerServerReasonUnavailable   = "partner_unavailable"
	PartnerServerReasonInvalidToken  = "invalid_token"
)

// PartnerServerSnapshot is what every partner server request needs to know
// about its partner. It is cached for partnerServerSnapshotTTL and evicted by
// every administrator write, so a revocation or suspension takes effect on the
// next request and at worst after the TTL.
type PartnerServerSnapshot struct {
	ClientId        string   `json:"client_id"`
	Name            string   `json:"name"`
	ClientEnabled   bool     `json:"client_enabled"`
	ServerEnabled   bool     `json:"server_enabled"`
	Suspended       bool     `json:"suspended"`
	AccountGroup    string   `json:"account_group"`
	IPAllowlist     []string `json:"ip_allowlist"`
	ActiveSecretIds []int64  `json:"active_secret_ids"`
}

// Available reports whether the partner may use server access right now.
func (s *PartnerServerSnapshot) Available() bool {
	return s.ClientEnabled && s.ServerEnabled && !s.Suspended
}

// IPAllowed reports whether ip may call on the partner's behalf. An empty
// allowlist allows every address (the administrator's choice, flagged in the
// console).
func (s *PartnerServerSnapshot) IPAllowed(ip string) bool {
	return partnerServerIPAllowed(s.IPAllowlist, ip)
}

// partnerServerToken is the cached, immutable part of an access token.
type partnerServerToken struct {
	ClientId  string `json:"client_id"`
	SecretId  int64  `json:"secret_id"`
	ExpiresAt int64  `json:"expires_at"`
}

// PartnerServerPrincipal is the authenticated partner of a server request.
type PartnerServerPrincipal struct {
	Partner *PartnerServerSnapshot
}

var (
	partnerServerSnapshotCacheOnce sync.Once
	partnerServerSnapshotCache     *cachex.HybridCache[PartnerServerSnapshot]
	partnerServerTokenCacheOnce    sync.Once
	partnerServerTokenCache        *cachex.HybridCache[partnerServerToken]
)

func getPartnerServerSnapshotCache() *cachex.HybridCache[PartnerServerSnapshot] {
	partnerServerSnapshotCacheOnce.Do(func() {
		partnerServerSnapshotCache = cachex.NewHybridCache[PartnerServerSnapshot](cachex.HybridCacheConfig[PartnerServerSnapshot]{
			Namespace:    cachex.Namespace("new-api:partner_server_snapshot:v1"),
			Redis:        common.RDB,
			RedisEnabled: func() bool { return common.RedisEnabled && common.RDB != nil },
			RedisCodec:   cachex.JSONCodec[PartnerServerSnapshot]{},
			Memory: func() *hot.HotCache[string, PartnerServerSnapshot] {
				return hot.NewHotCache[string, PartnerServerSnapshot](hot.LRU, partnerServerCacheCapacity).
					WithTTL(partnerServerSnapshotTTL).WithJanitor().Build()
			},
		})
	})
	return partnerServerSnapshotCache
}

func getPartnerServerTokenCache() *cachex.HybridCache[partnerServerToken] {
	partnerServerTokenCacheOnce.Do(func() {
		partnerServerTokenCache = cachex.NewHybridCache[partnerServerToken](cachex.HybridCacheConfig[partnerServerToken]{
			Namespace:    cachex.Namespace("new-api:partner_server_token:v1"),
			Redis:        common.RDB,
			RedisEnabled: func() bool { return common.RedisEnabled && common.RDB != nil },
			RedisCodec:   cachex.JSONCodec[partnerServerToken]{},
			Memory: func() *hot.HotCache[string, partnerServerToken] {
				return hot.NewHotCache[string, partnerServerToken](hot.LRU, partnerServerCacheCapacity).
					WithTTL(partnerServerTokenCacheMaxTTL).WithJanitor().Build()
			},
		})
	})
	return partnerServerTokenCache
}

// InvalidatePartnerServerSnapshot evicts the partner's cached snapshot. Call
// it after every committed change to the client, its server config or its
// secrets. A failed eviction is logged; the TTL bounds how long it lasts.
func InvalidatePartnerServerSnapshot(clientID string) {
	if clientID == "" {
		return
	}
	if _, err := getPartnerServerSnapshotCache().DeleteMany([]string{clientID}); err != nil {
		common.SysError(common.LogText("failed to evict partner server snapshot client_id=%s: %s", clientID, err.Error()))
	}
}

// LoadPartnerServerSnapshot returns the partner's snapshot, from the cache when
// present. A partner without server access configured is reported as
// unavailable rather than missing.
func LoadPartnerServerSnapshot(clientID string) (*PartnerServerSnapshot, error) {
	cache := getPartnerServerSnapshotCache()
	if cached, found, err := cache.Get(clientID); err == nil && found {
		return &cached, nil
	}
	client, err := model.GetPartnerOAuthClientByClientID(clientID)
	if err != nil {
		return nil, err
	}
	snapshot := &PartnerServerSnapshot{
		ClientId:      client.ClientId,
		Name:          client.Name,
		ClientEnabled: client.Status == model.PartnerOAuthClientStatusEnabled,
	}
	config, err := model.GetPartnerServerConfig(clientID)
	if err != nil && !errors.Is(err, model.ErrPartnerServerConfigNotFound) {
		return nil, err
	}
	if config != nil {
		snapshot.ServerEnabled = config.Enabled
		snapshot.Suspended = config.SuspendedAt != 0
		snapshot.AccountGroup = config.AccountGroup
		allowlist, err := ParsePartnerServerIPAllowlist(config.IPAllowlist)
		if err != nil {
			// A stored list that no longer parses must not silently open access.
			return nil, err
		}
		snapshot.IPAllowlist = allowlist
		secrets, err := model.ListActivePartnerServerSecrets(clientID)
		if err != nil {
			return nil, err
		}
		for _, secret := range secrets {
			snapshot.ActiveSecretIds = append(snapshot.ActiveSecretIds, secret.Id)
		}
	}
	if err := cache.SetWithTTL(clientID, *snapshot, partnerServerSnapshotTTL); err != nil {
		common.SysError(common.LogText("failed to cache partner server snapshot client_id=%s: %s", clientID, err.Error()))
	}
	return snapshot, nil
}

var (
	ErrPartnerServerIPAllowlistTooLong = errors.New("the IP allowlist has too many entries")
	ErrPartnerServerIPAllowlistInvalid = errors.New("the IP allowlist has an invalid entry")
)

// NormalizePartnerServerIPAllowlist validates administrator input (IPs or
// CIDR prefixes) and returns canonical prefixes.
func NormalizePartnerServerIPAllowlist(entries []string) ([]string, error) {
	if len(entries) > PartnerServerMaxIPEntries {
		return nil, ErrPartnerServerIPAllowlistTooLong
	}
	normalized := make([]string, 0, len(entries))
	for _, raw := range entries {
		raw = strings.TrimSpace(raw)
		if raw == "" {
			continue
		}
		var prefix netip.Prefix
		if strings.Contains(raw, "/") {
			parsed, err := netip.ParsePrefix(raw)
			if err != nil {
				return nil, ErrPartnerServerIPAllowlistInvalid
			}
			prefix = parsed.Masked()
		} else {
			addr, err := netip.ParseAddr(raw)
			if err != nil {
				return nil, ErrPartnerServerIPAllowlistInvalid
			}
			addr = addr.Unmap()
			prefix = netip.PrefixFrom(addr, addr.BitLen())
		}
		if !slices.Contains(normalized, prefix.String()) {
			normalized = append(normalized, prefix.String())
		}
	}
	return normalized, nil
}

// ParsePartnerServerIPAllowlist decodes the stored JSON allowlist.
func ParsePartnerServerIPAllowlist(raw string) ([]string, error) {
	if strings.TrimSpace(raw) == "" {
		return nil, nil
	}
	var entries []string
	if err := common.UnmarshalJsonStr(raw, &entries); err != nil {
		return nil, err
	}
	return NormalizePartnerServerIPAllowlist(entries)
}

func partnerServerIPAllowed(allowlist []string, ip string) bool {
	if len(allowlist) == 0 {
		return true
	}
	addr, err := netip.ParseAddr(ip)
	if err != nil {
		return false
	}
	addr = addr.Unmap()
	for _, entry := range allowlist {
		prefix, err := netip.ParsePrefix(entry)
		if err == nil && prefix.Contains(addr) {
			return true
		}
	}
	return false
}

// GeneratePartnerServerSecret returns a new server secret: 32 random bytes.
func GeneratePartnerServerSecret() (string, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return "pss_" + hex.EncodeToString(buf), nil
}

type PartnerServerTokenResponse struct {
	AccessToken string `json:"access_token"`
	TokenType   string `json:"token_type"`
	ExpiresIn   int    `json:"expires_in"`
	Scope       string `json:"scope"`
}

// partnerServerClientError is the single response for every client
// authentication failure, so callers cannot tell an unknown partner, a wrong
// secret, a blocked address and switched-off access apart.
func partnerServerClientError() *PartnerOAuthError {
	return &PartnerOAuthError{Status: http.StatusUnauthorized, Code: "invalid_client", Description: "client authentication failed", WWWAuth: `Basic realm="oauth"`}
}

// IssuePartnerServerToken authenticates a partner server with one of its
// active secrets and issues an access token (client credentials grant). It
// reads the database rather than the snapshot cache, so a revoked secret or a
// suspension is honoured immediately. On failure it returns the audit reason
// and whether the client exists.
func IssuePartnerServerToken(clientID, secret, scope, ip string) (*PartnerServerTokenResponse, string, bool, error) {
	var client *model.PartnerOAuthClient
	if validPartnerOAuthClientID(clientID) {
		client, _ = model.GetPartnerOAuthClientByClientID(clientID)
	}
	var secrets []model.PartnerServerSecret
	if client != nil {
		var err error
		if secrets, err = model.ListActivePartnerServerSecrets(clientID); err != nil {
			return nil, "", true, err
		}
	}
	// Compare against every candidate (or a placeholder) so the work done
	// does not reveal whether the partner or its secrets exist.
	computed := model.HashPartnerOAuthSecret(secret)
	var matched *model.PartnerServerSecret
	if len(secrets) == 0 {
		hmac.Equal([]byte(computed), []byte(partnerOAuthDummySecretHash))
	}
	for i := range secrets {
		if hmac.Equal([]byte(computed), []byte(secrets[i].SecretHash)) {
			matched = &secrets[i]
		}
	}
	if client == nil {
		return nil, PartnerServerReasonInvalidSecret, false, partnerServerClientError()
	}
	if matched == nil {
		return nil, PartnerServerReasonInvalidSecret, true, partnerServerClientError()
	}
	config, err := model.GetPartnerServerConfig(clientID)
	if err != nil && !errors.Is(err, model.ErrPartnerServerConfigNotFound) {
		return nil, "", true, err
	}
	if config == nil || client.Status != model.PartnerOAuthClientStatusEnabled || !config.Enabled || config.SuspendedAt != 0 {
		return nil, PartnerServerReasonUnavailable, true, partnerServerClientError()
	}
	allowlist, err := ParsePartnerServerIPAllowlist(config.IPAllowlist)
	if err != nil {
		return nil, "", true, err
	}
	if !partnerServerIPAllowed(allowlist, ip) {
		return nil, PartnerServerReasonIPNotAllowed, true, partnerServerClientError()
	}
	if scope != "" && scope != PartnerServerScope {
		return nil, "", true, partnerOAuthErr(http.StatusBadRequest, "invalid_scope", "scope must be "+PartnerServerScope)
	}
	raw, err := generatePartnerOpaqueToken("pst_")
	if err != nil {
		return nil, "", true, err
	}
	expiresAt := time.Now().Add(PartnerServerAccessTokenTTL).Unix()
	if err := model.CreatePartnerServerToken(&model.PartnerServerToken{
		TokenHash: model.HashPartnerOAuthToken(raw),
		ClientId:  clientID,
		SecretId:  matched.Id,
		ExpiresAt: expiresAt,
	}); err != nil {
		if errors.Is(err, model.ErrPartnerServerSecretNotFound) {
			return nil, PartnerServerReasonInvalidSecret, true, partnerServerClientError()
		}
		return nil, "", true, err
	}
	return &PartnerServerTokenResponse{
		AccessToken: raw,
		TokenType:   "Bearer",
		ExpiresIn:   int(PartnerServerAccessTokenTTL.Seconds()),
		Scope:       PartnerServerScope,
	}, "", true, nil
}

func partnerServerInvalidToken() *PartnerOAuthError {
	return &PartnerOAuthError{Status: http.StatusUnauthorized, Code: "invalid_token", Description: "access token is invalid", WWWAuth: `Bearer realm="partner", error="invalid_token"`}
}

// lookupPartnerServerToken resolves an access token, caching only tokens that
// exist so random tokens cannot fill the cache.
func lookupPartnerServerToken(tokenHash string) (*partnerServerToken, error) {
	cache := getPartnerServerTokenCache()
	if cached, found, err := cache.Get(tokenHash); err == nil && found {
		return &cached, nil
	}
	stored, err := model.FindPartnerServerToken(tokenHash)
	if err != nil {
		return nil, err
	}
	token := partnerServerToken{ClientId: stored.ClientId, SecretId: stored.SecretId, ExpiresAt: stored.ExpiresAt}
	ttl := min(time.Until(time.Unix(stored.ExpiresAt, 0)), partnerServerTokenCacheMaxTTL)
	if ttl > 0 {
		if err := cache.SetWithTTL(tokenHash, token, ttl); err != nil {
			common.SysError(common.LogText("failed to cache partner server token: %s", err.Error()))
		}
	}
	return &token, nil
}

// AuthenticatePartnerServerAccessToken checks a bearer token against the
// partner's current state: token unexpired, issued by a still-active secret,
// partner available and the caller's address allowed. On failure it returns
// the audit reason and the partner the token belonged to, if known.
func AuthenticatePartnerServerAccessToken(raw, ip string) (*PartnerServerPrincipal, string, string, error) {
	if !strings.HasPrefix(raw, "pst_") {
		return nil, PartnerServerReasonInvalidToken, "", partnerServerInvalidToken()
	}
	token, err := lookupPartnerServerToken(model.HashPartnerOAuthToken(raw))
	if errors.Is(err, model.ErrPartnerServerTokenNotFound) {
		return nil, PartnerServerReasonInvalidToken, "", partnerServerInvalidToken()
	}
	if err != nil {
		return nil, "", "", err
	}
	if token.ExpiresAt <= time.Now().Unix() {
		return nil, PartnerServerReasonInvalidToken, token.ClientId, partnerServerInvalidToken()
	}
	snapshot, err := LoadPartnerServerSnapshot(token.ClientId)
	if errors.Is(err, model.ErrPartnerOAuthClientNotFound) {
		return nil, PartnerServerReasonInvalidToken, "", partnerServerInvalidToken()
	}
	if err != nil {
		return nil, "", token.ClientId, err
	}
	if !slices.Contains(snapshot.ActiveSecretIds, token.SecretId) {
		return nil, PartnerServerReasonInvalidToken, token.ClientId, partnerServerInvalidToken()
	}
	if !snapshot.Available() {
		return nil, PartnerServerReasonUnavailable, token.ClientId, partnerServerInvalidToken()
	}
	if !snapshot.IPAllowed(ip) {
		return nil, PartnerServerReasonIPNotAllowed, token.ClientId, partnerServerInvalidToken()
	}
	return &PartnerServerPrincipal{Partner: snapshot}, "", token.ClientId, nil
}

func CleanupExpiredPartnerServerTokens() error {
	return model.DeleteExpiredPartnerServerTokens(time.Now().Unix())
}

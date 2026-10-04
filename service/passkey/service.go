package passkey

import (
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/go-webauthn/webauthn/protocol"
	webauthn "github.com/go-webauthn/webauthn/webauthn"
)

const (
	RegistrationSessionKey = "passkey_registration_session"
	LoginSessionKey        = "passkey_login_session"
	VerifySessionKey       = "passkey_verify_session"
)

var ErrRPIDUnavailable = system_setting.ErrPasskeyRPIDUnavailable

// BuildWebAuthn constructs a WebAuthn instance using the primary RP ID.
func BuildWebAuthn(r *http.Request) (*webauthn.WebAuthn, error) {
	settings := system_setting.PasskeySettingsSnapshot()
	if strings.TrimSpace(settings.LegacyRPIDs) != "" {
		return BuildWebAuthnForRPID(r, "")
	}
	origins, err := resolveOrigins(r, &settings)
	if err != nil {
		return nil, err
	}
	rpID, err := resolveRPID(r, &settings, origins)
	if err != nil {
		return nil, err
	}
	name := strings.TrimSpace(settings.RPDisplayName)
	if name == "" {
		name = common.SystemName
	}
	return newWebAuthn(settings, name, rpID, origins)
}

// BuildWebAuthnForRPID constructs a ceremony bound to one configured RP ID.
func BuildWebAuthnForRPID(r *http.Request, selectedRPID string) (*webauthn.WebAuthn, error) {
	settings := system_setting.PasskeySettingsSnapshot()
	if settings.Origins == "" && (settings.RPID != "" || settings.LegacyRPIDs != "") {
		return nil, ErrRPIDUnavailable
	}
	displayName := strings.TrimSpace(settings.RPDisplayName)
	if displayName == "" {
		displayName = common.SystemName
	}

	origins, err := resolveOrigins(r, &settings)
	if err != nil {
		return nil, err
	}
	primary, err := resolveRPID(r, &settings, origins)
	if err != nil {
		return nil, err
	}

	selected := primary
	if strings.TrimSpace(selectedRPID) != "" {
		selected = canonicalConfiguredRPID(append([]string{primary}, settings.RelyingPartyIDs()...), selectedRPID)
		if selected == "" {
			return nil, ErrRPIDUnavailable
		}
	}
	allowedOrigins := originsForRPID(origins, selected, settings.AllowInsecureOrigin)
	if len(allowedOrigins) == 0 || !requestOriginAllowed(r, allowedOrigins) {
		return nil, ErrRPIDUnavailable
	}

	return newWebAuthn(settings, displayName, selected, allowedOrigins)
}

// BuildLoginWebAuthn selects an RP ID from the server-side allowlist.
func BuildLoginWebAuthn(r *http.Request, hint, credentialRPID string) (*webauthn.WebAuthn, []string, error) {
	settings := system_setting.PasskeySettingsSnapshot()
	if settings.Origins == "" && (settings.RPID != "" || settings.LegacyRPIDs != "") {
		return nil, nil, ErrRPIDUnavailable
	}
	origins, err := resolveOrigins(r, &settings)
	if err != nil {
		return nil, nil, err
	}
	primary, err := resolveRPID(r, &settings, origins)
	if err != nil {
		return nil, nil, err
	}

	configured := append([]string{primary}, settings.RelyingPartyIDs()...)
	available := make([]string, 0, len(configured))
	for _, rpID := range configured {
		if canonicalConfiguredRPID(available, rpID) != "" {
			continue
		}
		allowedOrigins := originsForRPID(origins, rpID, settings.AllowInsecureOrigin)
		if len(allowedOrigins) == 0 || !requestOriginAllowed(r, allowedOrigins) {
			continue
		}
		available = append(available, rpID)
	}
	if len(available) == 0 {
		return nil, nil, ErrRPIDUnavailable
	}

	selected := ""
	if strings.TrimSpace(credentialRPID) != "" {
		selected = canonicalConfiguredRPID(available, credentialRPID)
	} else if strings.TrimSpace(hint) != "" {
		selected = canonicalConfiguredRPID(available, hint)
	} else {
		selected = available[0]
	}
	if selected == "" {
		return nil, nil, ErrRPIDUnavailable
	}
	wa, err := BuildWebAuthnForRPID(r, selected)
	return wa, available, err
}

func newWebAuthn(settings system_setting.PasskeySettings, displayName, rpID string, origins []string) (*webauthn.WebAuthn, error) {
	selection := protocol.AuthenticatorSelection{
		ResidentKey:        protocol.ResidentKeyRequirementRequired,
		RequireResidentKey: protocol.ResidentKeyRequired(),
		UserVerification:   protocol.UserVerificationRequirement(settings.UserVerification),
	}
	if selection.UserVerification == "" {
		selection.UserVerification = protocol.VerificationPreferred
	}
	if attachment := strings.TrimSpace(settings.AttachmentPreference); attachment != "" {
		selection.AuthenticatorAttachment = protocol.AuthenticatorAttachment(attachment)
	}

	config := &webauthn.Config{
		RPID:                   rpID,
		RPDisplayName:          displayName,
		RPOrigins:              origins,
		AuthenticatorSelection: selection,
		Debug:                  common.DebugEnabled,
		Timeouts: webauthn.TimeoutsConfig{
			Login: webauthn.TimeoutConfig{
				Enforce:    true,
				Timeout:    2 * time.Minute,
				TimeoutUVD: 2 * time.Minute,
			},
			Registration: webauthn.TimeoutConfig{
				Enforce:    true,
				Timeout:    2 * time.Minute,
				TimeoutUVD: 2 * time.Minute,
			},
		},
	}
	return webauthn.New(config)
}

func originsForRPID(origins []string, rpID string, allowInsecure ...bool) []string {
	allowHTTP := len(allowInsecure) > 0 && allowInsecure[0]
	rpID = strings.ToLower(strings.TrimSpace(rpID))
	allowed := make([]string, 0, len(origins))
	for _, origin := range origins {
		parsed, err := url.Parse(strings.TrimSpace(origin))
		if err != nil || parsed.Hostname() == "" || parsed.User != nil || parsed.Path != "" && parsed.Path != "/" || parsed.RawQuery != "" || parsed.Fragment != "" {
			continue
		}
		if parsed.Scheme != "https" && !((allowHTTP || isLocalHost(rpID)) && parsed.Scheme == "http") {
			continue
		}
		host := strings.ToLower(parsed.Hostname())
		if host == rpID || strings.HasSuffix(host, "."+rpID) {
			allowed = append(allowed, strings.TrimSpace(origin))
		}
	}
	return allowed
}

func canonicalConfiguredRPID(configured []string, candidate string) string {
	candidate = strings.TrimSpace(candidate)
	if candidate == "" {
		return ""
	}
	for _, id := range configured {
		if strings.EqualFold(strings.TrimSpace(id), candidate) {
			return id
		}
	}
	return ""
}

func requestOriginAllowed(r *http.Request, origins []string) bool {
	if r == nil {
		return false
	}
	origin := strings.TrimSpace(r.Header.Get("Origin"))
	if origin == "" {
		return false
	}
	return protocol.IsOriginInHaystack(origin, origins)
}

func resolveOrigins(r *http.Request, settings *system_setting.PasskeySettings) ([]string, error) {
	originsStr := strings.TrimSpace(settings.Origins)
	if originsStr != "" {
		originList := strings.FieldsFunc(originsStr, func(r rune) bool { return r == ',' || r == '\n' || r == '\r' })
		origins := make([]string, 0, len(originList))
		for _, origin := range originList {
			trimmed := strings.TrimSpace(origin)
			if trimmed == "" {
				continue
			}
			if !settings.AllowInsecureOrigin && strings.HasPrefix(strings.ToLower(trimmed), "http://") {
				return nil, fmt.Errorf("Passkey 不允许使用不安全的 Origin: %s", trimmed)
			}
			origins = append(origins, trimmed)
		}
		if len(origins) > 0 {
			return origins, nil
		}
	}

	scheme := detectScheme(r)
	if r != nil && scheme == "http" && !settings.AllowInsecureOrigin && !isLocalHost(r.Host) {
		return nil, fmt.Errorf("Passkey 仅支持 HTTPS，当前访问: %s://%s，请在 Passkey 设置中允许不安全 Origin 或配置 HTTPS", scheme, r.Host)
	}
	host := ""
	if r != nil {
		host = r.Host
	}
	if host == "" && system_setting.ServerAddress != "" {
		if parsed, err := url.Parse(system_setting.ServerAddress); err == nil && parsed.Host != "" {
			host = parsed.Host
			if scheme == "" && parsed.Scheme != "" {
				scheme = parsed.Scheme
			}
		}
	}
	if host == "" {
		return nil, fmt.Errorf("无法确定 Passkey 的 Origin，请在系统设置或 Passkey 设置中指定。当前 Host: '%s', ServerAddress: '%s'", hostFromRequest(r), system_setting.ServerAddress)
	}
	if scheme == "" {
		scheme = "https"
	}
	return []string{fmt.Sprintf("%s://%s", scheme, host)}, nil
}

func resolveRPID(r *http.Request, settings *system_setting.PasskeySettings, origins []string) (string, error) {
	if rpID := settings.EffectiveRPID(); rpID != "" {
		return hostWithoutPort(rpID), nil
	}
	if len(origins) == 0 {
		return "", errors.New("Passkey 未配置 Origin，无法推导 RPID")
	}
	parsed, err := url.Parse(origins[0])
	if err != nil {
		return "", fmt.Errorf("无法解析 Passkey Origin: %w", err)
	}
	return hostWithoutPort(parsed.Host), nil
}

func hostWithoutPort(host string) string {
	host = strings.TrimSpace(host)
	if host == "" {
		return ""
	}
	if strings.Contains(host, ":") {
		if parsedHost, _, err := net.SplitHostPort(host); err == nil {
			return parsedHost
		}
	}
	return host
}

func isLocalHost(host string) bool {
	host = strings.ToLower(hostWithoutPort(host))
	return host == "localhost" || host == "127.0.0.1" || host == "::1"
}

func hostFromRequest(r *http.Request) string {
	if r == nil {
		return ""
	}
	return r.Host
}

func detectScheme(r *http.Request) string {
	if r == nil {
		return ""
	}
	if proto := r.Header.Get("X-Forwarded-Proto"); proto != "" {
		parts := strings.Split(proto, ",")
		return strings.ToLower(strings.TrimSpace(parts[0]))
	}
	if r.TLS != nil {
		return "https"
	}
	if r.URL != nil && r.URL.Scheme != "" {
		return strings.ToLower(r.URL.Scheme)
	}
	if proto := r.Header.Get("X-Forwarded-Protocol"); proto != "" {
		return strings.ToLower(strings.TrimSpace(proto))
	}
	return "http"
}

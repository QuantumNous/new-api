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
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/setting/system_setting"

	"github.com/go-webauthn/webauthn/protocol"
	webauthn "github.com/go-webauthn/webauthn/webauthn"
)

const (
	RegistrationSessionKey = "passkey_registration_session"
	LoginSessionKey        = "passkey_login_session"
	VerifySessionKey       = "passkey_verify_session"
)

// BuildWebAuthn constructs a WebAuthn instance using the current passkey settings and request context.
func BuildWebAuthn(r *http.Request) (*webauthn.WebAuthn, error) {
	settings := system_setting.GetPasskeySettings()
	if settings == nil {
		return nil, errors.New(i18n.Translate("passkey.setting_not_found"))
	}

	displayName := strings.TrimSpace(settings.RPDisplayName)
	if displayName == "" {
		displayName = common.SystemName
	}

	origins, err := resolveOrigins(r, settings)
	if err != nil {
		return nil, err
	}

	rpID, err := resolveRPID(r, settings, origins)
	if err != nil {
		return nil, err
	}

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

func resolveOrigins(r *http.Request, settings *system_setting.PasskeySettings) ([]string, error) {
	originsStr := strings.TrimSpace(settings.Origins)
	if originsStr != "" {
		originList := strings.Split(originsStr, ",")
		origins := make([]string, 0, len(originList))
		for _, origin := range originList {
			trimmed := strings.TrimSpace(origin)
			if trimmed == "" {
				continue
			}
			if !settings.AllowInsecureOrigin && strings.HasPrefix(strings.ToLower(trimmed), "http://") {
				return nil, fmt.Errorf("%s", i18n.Translate("passkey.insecure_origin", map[string]any{"Origin": trimmed}))
			}
			origins = append(origins, trimmed)
		}
		if len(origins) == 0 {
			// 如果配置了Origins但过滤后为空，使用自动推导
			goto autoDetect
		}
		return origins, nil
	}

autoDetect:
	scheme := detectScheme(r)
	if scheme == "http" && !settings.AllowInsecureOrigin && r.Host != "localhost" && r.Host != "127.0.0.1" && !strings.HasPrefix(r.Host, "127.0.0.1:") && !strings.HasPrefix(r.Host, "localhost:") {
		return nil, fmt.Errorf("%s", i18n.Translate("passkey.insecure_origin", map[string]any{"Origin": fmt.Sprintf("%s://%s", scheme, r.Host)}))
	}
	// 优先使用请求的完整Host（包含端口）
	host := r.Host

	// 如果无法从请求获取Host，尝试从ServerAddress获取
	if host == "" && system_setting.ServerAddress != "" {
		if parsed, err := url.Parse(system_setting.ServerAddress); err == nil && parsed.Host != "" {
			host = parsed.Host
			if scheme == "" && parsed.Scheme != "" {
				scheme = parsed.Scheme
			}
		}
	}
	if host == "" {
		return nil, fmt.Errorf("%s", i18n.Translate("passkey.origin_undetermined", map[string]any{"Host": r.Host, "ServerAddress": system_setting.ServerAddress}))
	}
	if scheme == "" {
		scheme = "https"
	}
	origin := fmt.Sprintf("%s://%s", scheme, host)
	return []string{origin}, nil
}

func resolveRPID(r *http.Request, settings *system_setting.PasskeySettings, origins []string) (string, error) {
	rpID := strings.TrimSpace(settings.RPID)
	if rpID != "" {
		return hostWithoutPort(rpID), nil
	}
	if len(origins) == 0 {
		return "", errors.New(i18n.Translate("passkey.origin_not_configured"))
	}
	parsed, err := url.Parse(origins[0])
	if err != nil {
		return "", fmt.Errorf("%s", i18n.Translate("passkey.origin_parse_failed", map[string]any{"Error": err.Error()}))
	}
	return hostWithoutPort(parsed.Host), nil
}

func hostWithoutPort(host string) string {
	host = strings.TrimSpace(host)
	if host == "" {
		return ""
	}
	if strings.Contains(host, ":") {
		if host, _, err := net.SplitHostPort(host); err == nil {
			return host
		}
	}
	return host
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
	if r.Header.Get("X-Forwarded-Protocol") != "" {
		return strings.ToLower(strings.TrimSpace(r.Header.Get("X-Forwarded-Protocol")))
	}
	return "http"
}

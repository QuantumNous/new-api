package system_setting

import (
	"errors"
	"net"
	"net/url"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/config"
	"golang.org/x/net/idna"
	"golang.org/x/net/publicsuffix"
)

type PasskeySettings struct {
	Enabled              bool   `json:"enabled"`
	RPDisplayName        string `json:"rp_display_name"`
	RPID                 string `json:"rp_id"`
	LegacyRPIDs          string `json:"legacy_rp_ids"`
	Origins              string `json:"origins"`
	AllowInsecureOrigin  bool   `json:"allow_insecure_origin"`
	UserVerification     string `json:"user_verification"`
	AttachmentPreference string `json:"attachment_preference"`
}

var (
	ErrPasskeyRPIDInvalid     = errors.New("invalid Passkey relying party domain")
	ErrPasskeyRPIDUnavailable = errors.New("Passkey domain is not available on this website")
)

var defaultPasskeySettings = PasskeySettings{
	Enabled:              false,
	RPDisplayName:        common.SystemName,
	RPID:                 "",
	LegacyRPIDs:          "",
	Origins:              "",
	AllowInsecureOrigin:  false,
	UserVerification:     "preferred",
	AttachmentPreference: "",
}

func init() {
	config.GlobalConfig.Register("passkey", &defaultPasskeySettings)
}

// PasskeySettingsSnapshot returns a copy with legacy defaults applied.
func PasskeySettingsSnapshot() PasskeySettings {
	common.OptionMapRWMutex.RLock()
	settings := defaultPasskeySettings
	serverAddress := ServerAddress
	common.OptionMapRWMutex.RUnlock()
	return settings.WithDefaults(serverAddress)
}

func GetPasskeySettings() *PasskeySettings {
	settings := PasskeySettingsSnapshot()
	return &settings
}

// WithDefaults preserves the pre-multi-domain ServerAddress fallback.
func (s PasskeySettings) WithDefaults(serverAddress string) PasskeySettings {
	if strings.TrimSpace(s.RPID) == "" && strings.TrimSpace(serverAddress) != "" {
		serverAddr := strings.TrimSpace(serverAddress)
		if parsed, err := url.Parse(serverAddr); err == nil && parsed.Host != "" {
			s.RPID = parsed.Host
		} else {
			s.RPID = serverAddr
		}
	}
	if strings.TrimSpace(s.Origins) == "" || strings.TrimSpace(s.Origins) == "[]" {
		s.Origins = serverAddress
	}
	return s
}

func (s PasskeySettings) EffectiveRPID() string {
	rpID := strings.TrimSpace(s.RPID)
	if rpID == "" {
		for _, origin := range splitPasskeyValues(s.Origins) {
			if parsed, err := url.Parse(strings.TrimSpace(origin)); err == nil && parsed.Host != "" {
				return parsed.Hostname()
			}
		}
	}
	if host, _, err := net.SplitHostPort(rpID); err == nil {
		return host
	}
	return rpID
}

func NormalizePasskeyRPID(value string, configuredOrigins ...string) (string, error) {
	rpID, err := idna.Lookup.ToASCII(strings.TrimSpace(value))
	if err != nil {
		return "", ErrPasskeyRPIDInvalid
	}
	rpID = strings.ToLower(rpID)
	if rpID == "" || len(rpID) > 253 || strings.ContainsAny(rpID, ":/*@?#\\") || net.ParseIP(rpID) != nil {
		return "", ErrPasskeyRPIDInvalid
	}
	for _, label := range strings.Split(rpID, ".") {
		if label == "" || len(label) > 63 || label[0] == '-' || label[len(label)-1] == '-' {
			return "", ErrPasskeyRPIDInvalid
		}
		for _, c := range label {
			if c != '-' && (c < 'a' || c > 'z') && (c < '0' || c > '9') {
				return "", ErrPasskeyRPIDInvalid
			}
		}
	}
	if rpID == "localhost" {
		return rpID, nil
	}
	if _, err := publicsuffix.EffectiveTLDPlusOne(rpID); err == nil {
		return rpID, nil
	}
	_, icann := publicsuffix.PublicSuffix(rpID)
	if icann || strings.Contains(rpID, ".") {
		return "", ErrPasskeyRPIDInvalid
	}
	for _, origins := range configuredOrigins {
		for _, rawOrigin := range splitPasskeyValues(origins) {
			parsed, err := url.Parse(rawOrigin)
			if err != nil || parsed.Scheme != "https" || parsed.User != nil || parsed.Host == "" || (parsed.Path != "" && parsed.Path != "/") || parsed.RawQuery != "" || parsed.Fragment != "" {
				continue
			}
			if strings.EqualFold(parsed.Hostname(), rpID) {
				return rpID, nil
			}
		}
	}
	return "", ErrPasskeyRPIDInvalid
}

func ParsePasskeyRPIDs(value string, configuredOrigins ...string) ([]string, error) {
	ids := make([]string, 0)
	for _, raw := range splitPasskeyValues(value) {
		normalized, err := NormalizePasskeyRPID(raw, configuredOrigins...)
		if err != nil {
			return nil, err
		}
		id := normalized
		duplicate := false
		for _, existing := range ids {
			if strings.EqualFold(existing, id) {
				duplicate = true
				break
			}
		}
		if !duplicate {
			ids = append(ids, id)
		}
	}
	return ids, nil
}

func (s PasskeySettings) RelyingPartyIDs() []string {
	ids := make([]string, 0, 1)
	if primary := s.EffectiveRPID(); primary != "" {
		ids = append(ids, primary)
	}
	legacy, err := ParsePasskeyRPIDs(s.LegacyRPIDs, s.Origins)
	if err != nil {
		return ids
	}
	for _, id := range legacy {
		duplicate := false
		for _, existing := range ids {
			if strings.EqualFold(existing, id) {
				duplicate = true
				break
			}
		}
		if !duplicate {
			ids = append(ids, id)
		}
	}
	return ids
}

func splitPasskeyValues(value string) []string {
	return strings.FieldsFunc(value, func(r rune) bool {
		return r == ',' || r == '\n' || r == '\r'
	})
}

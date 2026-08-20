package system_setting

import (
	"errors"
	"net/url"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/setting/config"
)

var errInvalidAppConsoleOrigin = errors.New("app console origin must be empty or an absolute http(s) origin")

type AppConsoleSettings struct {
	Origin string `json:"origin"`
}

var appConsoleSettings = AppConsoleSettings{}

func init() {
	config.GlobalConfig.Register("app_console", &appConsoleSettings)
}

func GetAppConsoleSettings() *AppConsoleSettings {
	return &appConsoleSettings
}

func NormalizeAppConsoleOrigin(value string) (string, error) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return "", nil
	}

	parsed, err := url.Parse(trimmed)
	if err != nil {
		return "", errInvalidAppConsoleOrigin
	}
	scheme := strings.ToLower(parsed.Scheme)
	if (scheme != "http" && scheme != "https") || parsed.Host == "" || parsed.Hostname() == "" {
		return "", errInvalidAppConsoleOrigin
	}
	if parsed.User != nil || (parsed.Path != "" && parsed.Path != "/") || parsed.RawQuery != "" || parsed.Fragment != "" {
		return "", errInvalidAppConsoleOrigin
	}
	if !appConsoleOriginHostValid(parsed.Host, parsed.Hostname(), parsed.Port()) {
		return "", errInvalidAppConsoleOrigin
	}

	return scheme + "://" + parsed.Host, nil
}

// ResolveConsoleOrigin returns the configured app-console origin, falling back
// to ServerAddress. Empty when neither is set. Used to build user-facing links
// (e.g. "sign in at <origin>/sign-in") without hardcoding a host.
func ResolveConsoleOrigin() string {
	if origin, err := NormalizeAppConsoleOrigin(GetAppConsoleSettings().Origin); err == nil && origin != "" {
		return origin
	}
	if origin, err := NormalizeAppConsoleOrigin(ServerAddress); err == nil {
		return origin
	}
	return ""
}

func appConsoleOriginHostValid(host, hostname, port string) bool {
	if port != "" {
		portNumber, err := strconv.Atoi(port)
		if err != nil || portNumber < 1 || portNumber > 65535 {
			return false
		}
	}
	if strings.HasPrefix(host, "[") {
		suffix := strings.TrimPrefix(host, "["+hostname+"]")
		return suffix == "" || suffix == ":"+port
	}
	if strings.Contains(host, ":") {
		return port != "" && host == hostname+":"+port
	}
	return host == hostname
}

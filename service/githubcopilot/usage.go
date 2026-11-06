package githubcopilot

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
)

const copilotAccountUsageURL = "https://api.github.com/copilot_internal/user"

type profileUser struct {
	Host  string `json:"host"`
	Login string `json:"login"`
}

type profileToken struct {
	Token string `json:"token"`
}

type copilotProfileConfig struct {
	AuthTokens       map[string]profileToken `json:"authTokens"`
	LoggedInUsers    []profileUser           `json:"loggedInUsers"`
	LastLoggedInUser profileUser             `json:"lastLoggedInUser"`
}

func FetchAccountUsage(ctx context.Context, key ChannelKey) (int, []byte, error) {
	dir, err := profileDir(key.ProfileID)
	if err != nil {
		return 0, nil, err
	}
	data, err := os.ReadFile(filepath.Join(dir, "config.json"))
	if err != nil {
		return 0, nil, fmt.Errorf("read GitHub Copilot profile config: %w", err)
	}
	var config copilotProfileConfig
	if err := common.Unmarshal(stripJSONComments(data), &config); err != nil {
		return 0, nil, fmt.Errorf("decode GitHub Copilot profile config: %w", err)
	}
	_, token, err := selectGitHubToken(config, key.Login)
	if err != nil {
		return 0, nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, copilotAccountUsageURL, nil)
	if err != nil {
		return 0, nil, fmt.Errorf("create GitHub Copilot account usage request: %w", err)
	}
	req.Header.Set("Authorization", "token "+token)
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Editor-Version", "vscode/1.100.0")
	req.Header.Set("Editor-Plugin-Version", "copilot-chat/0.26.0")
	req.Header.Set("User-Agent", "GitHubCopilotChat/0.26.0")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")

	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.Proxy = nil
	if proxy := strings.TrimSpace(os.Getenv("COPILOT_PROXY")); proxy != "" {
		proxyURL, err := url.Parse(proxy)
		if err != nil || proxyURL.Scheme == "" || proxyURL.Host == "" {
			return 0, nil, errors.New("COPILOT_PROXY must be a valid HTTP proxy URL")
		}
		transport.Proxy = http.ProxyURL(proxyURL)
	}
	client := &http.Client{Transport: transport, Timeout: 20 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return 0, nil, fmt.Errorf("fetch GitHub Copilot account usage: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
	if err != nil {
		return resp.StatusCode, nil, fmt.Errorf("read GitHub Copilot account usage: %w", err)
	}
	return resp.StatusCode, body, nil
}

func selectGitHubToken(config copilotProfileConfig, expectedLogin string) (string, string, error) {
	login := strings.TrimSpace(expectedLogin)
	if login == "" {
		login = strings.TrimSpace(config.LastLoggedInUser.Login)
	}
	if login == "" {
		for _, user := range config.LoggedInUsers {
			if strings.EqualFold(strings.TrimSpace(user.Host), "https://github.com") && strings.TrimSpace(user.Login) != "" {
				login = strings.TrimSpace(user.Login)
				break
			}
		}
	}

	if login != "" {
		for _, suffix := range []string{":github", ""} {
			if token := tokenValue(config.AuthTokens["https://github.com:"+login+suffix]); token != "" {
				return login, token, nil
			}
		}
	}

	keys := make([]string, 0, len(config.AuthTokens))
	for key := range config.AuthTokens {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	for _, key := range keys {
		tokenLogin, ok := githubLoginFromTokenKey(key)
		if !ok || (login != "" && !strings.EqualFold(login, tokenLogin)) {
			continue
		}
		if token := tokenValue(config.AuthTokens[key]); token != "" {
			return tokenLogin, token, nil
		}
	}
	if login != "" {
		return "", "", fmt.Errorf("GitHub Copilot profile has no stored token for account %s; reconnect the account", login)
	}
	return "", "", errors.New("GitHub Copilot profile has no stored GitHub token; reconnect the account")
}

func githubLoginFromTokenKey(key string) (string, bool) {
	rest, ok := strings.CutPrefix(key, "https://github.com:")
	if !ok {
		return "", false
	}
	login, _, _ := strings.Cut(rest, ":")
	login = strings.TrimSpace(login)
	return login, login != ""
}

func tokenValue(token profileToken) string {
	return strings.TrimSpace(token.Token)
}

func stripJSONComments(data []byte) []byte {
	cleaned := make([]byte, 0, len(data))
	inString := false
	escaped := false
	for i := 0; i < len(data); i++ {
		current := data[i]
		if inString {
			cleaned = append(cleaned, current)
			if escaped {
				escaped = false
			} else if current == '\\' {
				escaped = true
			} else if current == '"' {
				inString = false
			}
			continue
		}
		if current == '"' {
			inString = true
			cleaned = append(cleaned, current)
			continue
		}
		if current == '/' && i+1 < len(data) {
			if data[i+1] == '/' {
				for i < len(data) && data[i] != '\n' {
					i++
				}
				cleaned = append(cleaned, '\n')
				continue
			}
			if data[i+1] == '*' {
				i += 2
				for i+1 < len(data) && !(data[i] == '*' && data[i+1] == '/') {
					if data[i] == '\n' {
						cleaned = append(cleaned, '\n')
					}
					i++
				}
				i++
				continue
			}
		}
		cleaned = append(cleaned, current)
	}
	return cleaned
}

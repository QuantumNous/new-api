package governorlab

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
)

type BootstrapConfig struct {
	Username           string
	Password           string
	SelfUseModeEnabled bool
	DemoSiteEnabled    bool
	ChannelName        string
	ChannelKey         string
	ChannelType        int
	ChannelModel       string
	ChannelGroup       string
	ChannelBaseURL     string
	ChannelSettings    string
	TokenName          string
	TokenGroup         string
}

type BootstrapResult struct {
	UserID    int    `json:"user_id"`
	ChannelID int    `json:"channel_id"`
	TokenID   int    `json:"token_id"`
	APIKey    string `json:"api_key"`
	Model     string `json:"model"`
	BaseURL   string `json:"base_url"`
}

type Client struct {
	baseURL    string
	httpClient *http.Client
}

func NewClient(baseURL string) (*Client, error) {
	jar, err := cookiejar.New(nil)
	if err != nil {
		return nil, err
	}
	return &Client{
		baseURL: strings.TrimRight(baseURL, "/"),
		httpClient: &http.Client{
			Jar: jar,
		},
	}, nil
}

func RequiresPrivateIPAccess(baseURL string) bool {
	parsed, err := url.Parse(baseURL)
	if err != nil {
		return false
	}

	host := strings.ToLower(parsed.Hostname())
	if host == "" {
		return false
	}
	if host == "localhost" {
		return true
	}

	ip := net.ParseIP(host)
	if ip == nil {
		return false
	}
	return ip.IsLoopback() || ip.IsPrivate()
}

func (c *Client) Bootstrap(ctx context.Context, cfg BootstrapConfig) (*BootstrapResult, error) {
	cfg = cfg.normalized()
	if err := cfg.validate(); err != nil {
		return nil, err
	}

	setupState, err := c.getSetup(ctx)
	if err != nil {
		return nil, err
	}
	if !setupState.Status {
		if err := c.postSetup(ctx, cfg); err != nil {
			return nil, err
		}
	}

	userID, err := c.login(ctx, cfg.Username, cfg.Password)
	if err != nil {
		return nil, err
	}

	if RequiresPrivateIPAccess(cfg.ChannelBaseURL) {
		if err := c.updateOption(ctx, userID, "fetch_setting.allow_private_ip", true); err != nil {
			return nil, err
		}
	}

	if err := c.recreateChannel(ctx, userID, cfg); err != nil {
		return nil, err
	}
	if err := c.fixChannelAbilities(ctx, userID); err != nil {
		return nil, err
	}

	channelID, err := c.findChannelIDByName(ctx, userID, cfg.ChannelName)
	if err != nil {
		return nil, err
	}

	if err := c.recreateToken(ctx, userID, cfg); err != nil {
		return nil, err
	}

	tokenID, err := c.findTokenIDByName(ctx, userID, cfg.TokenName)
	if err != nil {
		return nil, err
	}

	apiKey, err := c.getTokenKey(ctx, userID, tokenID)
	if err != nil {
		return nil, err
	}

	return &BootstrapResult{
		UserID:    userID,
		ChannelID: channelID,
		TokenID:   tokenID,
		APIKey:    apiKey,
		Model:     cfg.ChannelModel,
		BaseURL:   c.baseURL,
	}, nil
}

func WriteEnvFile(path string, result *BootstrapResult) error {
	if result == nil {
		return fmt.Errorf("bootstrap result is nil")
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}

	lines := []string{
		"GOVERNOR_LAB_BASE_URL=" + quoteEnvValue(result.BaseURL),
		"GOVERNOR_LAB_USER_ID=" + strconv.Itoa(result.UserID),
		"GOVERNOR_LAB_CHANNEL_ID=" + strconv.Itoa(result.ChannelID),
		"GOVERNOR_LAB_TOKEN_ID=" + strconv.Itoa(result.TokenID),
		"GOVERNOR_LAB_API_KEY=" + quoteEnvValue(result.APIKey),
		"GOVERNOR_LAB_MODEL=" + quoteEnvValue(result.Model),
	}
	content := strings.Join(lines, "\n") + "\n"
	return os.WriteFile(path, []byte(content), 0o644)
}

type apiEnvelope struct {
	Success bool            `json:"success"`
	Message string          `json:"message"`
	Data    json.RawMessage `json:"data"`
}

type setupState struct {
	Status bool `json:"status"`
}

type loginState struct {
	ID int `json:"id"`
}

type channelSummary struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

type tokenSummary struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

func (cfg BootstrapConfig) normalized() BootstrapConfig {
	if cfg.ChannelType == 0 {
		cfg.ChannelType = 1
	}
	if cfg.ChannelGroup == "" {
		cfg.ChannelGroup = "default"
	}
	if cfg.TokenGroup == "" {
		cfg.TokenGroup = "default"
	}
	cfg.ChannelBaseURL = strings.TrimRight(cfg.ChannelBaseURL, "/")
	cfg.ChannelSettings = strings.TrimSpace(cfg.ChannelSettings)
	return cfg
}

func (cfg BootstrapConfig) validate() error {
	switch {
	case cfg.Username == "":
		return fmt.Errorf("username is required")
	case cfg.Password == "":
		return fmt.Errorf("password is required")
	case cfg.ChannelName == "":
		return fmt.Errorf("channel name is required")
	case cfg.ChannelKey == "":
		return fmt.Errorf("channel key is required")
	case cfg.ChannelModel == "":
		return fmt.Errorf("channel model is required")
	case cfg.ChannelBaseURL == "":
		return fmt.Errorf("channel base URL is required")
	case cfg.ChannelSettings == "":
		return fmt.Errorf("channel settings JSON is required")
	case cfg.TokenName == "":
		return fmt.Errorf("token name is required")
	}
	return nil
}

func (c *Client) getSetup(ctx context.Context) (*setupState, error) {
	var state setupState
	if err := c.doJSON(ctx, http.MethodGet, "/api/setup", 0, nil, &state); err != nil {
		return nil, err
	}
	return &state, nil
}

func (c *Client) postSetup(ctx context.Context, cfg BootstrapConfig) error {
	payload := map[string]any{
		"username":           cfg.Username,
		"password":           cfg.Password,
		"confirmPassword":    cfg.Password,
		"SelfUseModeEnabled": cfg.SelfUseModeEnabled,
		"DemoSiteEnabled":    cfg.DemoSiteEnabled,
	}
	return c.doJSON(ctx, http.MethodPost, "/api/setup", 0, payload, nil)
}

func (c *Client) login(ctx context.Context, username, password string) (int, error) {
	var login loginState
	if err := c.doJSON(ctx, http.MethodPost, "/api/user/login", 0, map[string]string{
		"username": username,
		"password": password,
	}, &login); err != nil {
		return 0, err
	}
	if login.ID <= 0 {
		return 0, fmt.Errorf("login did not return a valid user id")
	}
	return login.ID, nil
}

func (c *Client) updateOption(ctx context.Context, userID int, key string, value any) error {
	return c.doJSON(ctx, http.MethodPut, "/api/option/", userID, map[string]any{
		"key":   key,
		"value": value,
	}, nil)
}

func (c *Client) recreateChannel(ctx context.Context, userID int, cfg BootstrapConfig) error {
	channels, err := c.listChannels(ctx, userID)
	if err != nil {
		return err
	}
	for _, entry := range channels {
		if entry.Name == cfg.ChannelName {
			if err := c.doJSON(ctx, http.MethodDelete, "/api/channel/"+strconv.Itoa(entry.ID), userID, nil, nil); err != nil {
				return err
			}
		}
	}

	payload := map[string]any{
		"mode": "single",
		"channel": map[string]any{
			"name":       cfg.ChannelName,
			"type":       cfg.ChannelType,
			"key":        cfg.ChannelKey,
			"models":     cfg.ChannelModel,
			"group":      cfg.ChannelGroup,
			"base_url":   cfg.ChannelBaseURL,
			"setting":    cfg.ChannelSettings,
			"test_model": cfg.ChannelModel,
			"status":     1,
		},
	}
	return c.doJSON(ctx, http.MethodPost, "/api/channel/", userID, payload, nil)
}

func (c *Client) recreateToken(ctx context.Context, userID int, cfg BootstrapConfig) error {
	tokens, err := c.listTokens(ctx, userID)
	if err != nil {
		return err
	}
	for _, entry := range tokens {
		if entry.Name == cfg.TokenName {
			if err := c.doJSON(ctx, http.MethodDelete, "/api/token/"+strconv.Itoa(entry.ID), userID, nil, nil); err != nil {
				return err
			}
		}
	}

	payload := map[string]any{
		"name":                 cfg.TokenName,
		"remain_quota":         0,
		"unlimited_quota":      true,
		"expired_time":         -1,
		"model_limits_enabled": false,
		"group":                cfg.TokenGroup,
	}
	return c.doJSON(ctx, http.MethodPost, "/api/token/", userID, payload, nil)
}

func (c *Client) fixChannelAbilities(ctx context.Context, userID int) error {
	return c.doJSON(ctx, http.MethodPost, "/api/channel/fix", userID, map[string]any{}, nil)
}

func (c *Client) findChannelIDByName(ctx context.Context, userID int, name string) (int, error) {
	channels, err := c.listChannels(ctx, userID)
	if err != nil {
		return 0, err
	}
	return highestNamedID(name, channels)
}

func (c *Client) findTokenIDByName(ctx context.Context, userID int, name string) (int, error) {
	tokens, err := c.listTokens(ctx, userID)
	if err != nil {
		return 0, err
	}
	return highestNamedID(name, tokens)
}

func highestNamedID[T interface {
	GetID() int
	GetName() string
}](name string, entries []T) (int, error) {
	matchID := 0
	for _, entry := range entries {
		if entry.GetName() == name && entry.GetID() > matchID {
			matchID = entry.GetID()
		}
	}
	if matchID == 0 {
		return 0, fmt.Errorf("no entry named %q found after creation", name)
	}
	return matchID, nil
}

func (c *Client) listChannels(ctx context.Context, userID int) ([]channelSummary, error) {
	var response struct {
		Items []channelSummary `json:"items"`
	}
	if err := c.doJSON(ctx, http.MethodGet, "/api/channel/?p=1&page_size=1000&id_sort=true", userID, nil, &response); err != nil {
		return nil, err
	}
	return response.Items, nil
}

func (c *Client) listTokens(ctx context.Context, userID int) ([]tokenSummary, error) {
	var response struct {
		Items []tokenSummary `json:"items"`
	}
	if err := c.doJSON(ctx, http.MethodGet, "/api/token/?p=1&page_size=1000", userID, nil, &response); err != nil {
		return nil, err
	}
	return response.Items, nil
}

func (c *Client) getTokenKey(ctx context.Context, userID, tokenID int) (string, error) {
	var response struct {
		Key string `json:"key"`
	}
	if err := c.doJSON(ctx, http.MethodPost, "/api/token/"+strconv.Itoa(tokenID)+"/key", userID, map[string]any{}, &response); err != nil {
		return "", err
	}
	if response.Key == "" {
		return "", fmt.Errorf("token key response was empty")
	}
	return response.Key, nil
}

func (c *Client) doJSON(ctx context.Context, method, path string, userID int, payload any, out any) error {
	var body io.Reader
	if payload != nil {
		jsonBody, err := json.Marshal(payload)
		if err != nil {
			return err
		}
		body = bytes.NewReader(jsonBody)
	}

	req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, body)
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	if userID > 0 {
		req.Header.Set("New-Api-User", strconv.Itoa(userID))
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		rawBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("request %s %s returned status %d: %s", method, path, resp.StatusCode, strings.TrimSpace(string(rawBody)))
	}

	var envelope apiEnvelope
	if err := json.NewDecoder(resp.Body).Decode(&envelope); err != nil {
		return err
	}
	if !envelope.Success {
		if envelope.Message == "" {
			envelope.Message = "request failed"
		}
		return fmt.Errorf("%s %s failed: %s", method, path, envelope.Message)
	}
	if out == nil || len(envelope.Data) == 0 || bytes.Equal(bytes.TrimSpace(envelope.Data), []byte("null")) {
		return nil
	}
	return json.Unmarshal(envelope.Data, out)
}

func quoteEnvValue(value string) string {
	replacer := strings.NewReplacer(`\`, `\\`, `"`, `\"`)
	return `"` + replacer.Replace(value) + `"`
}

func (entry channelSummary) GetID() int      { return entry.ID }
func (entry channelSummary) GetName() string { return entry.Name }
func (entry tokenSummary) GetID() int        { return entry.ID }
func (entry tokenSummary) GetName() string   { return entry.Name }

func LoadChannelSettings(path string) (string, error) {
	content, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	settings := strings.TrimSpace(string(content))
	if settings == "" {
		return "", fmt.Errorf("channel settings file %s is empty", path)
	}
	return settings, nil
}

func DefaultMockPortAllowed(port int) bool {
	return slices.Contains([]int{80, 443, 8080, 8443}, port)
}

package githubcopilot

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/url"
	"os"
	"os/exec"
	"regexp"
	"strings"
	"sync"
	"time"

	"path/filepath"

	"github.com/google/uuid"
)

const (
	rpcTimeout           = 30 * time.Second
	endpointRefreshEarly = 30 * time.Second
	modelsCacheTTL       = 5 * time.Minute
)

var headerNamePattern = regexp.MustCompile(`^[!#$%&'*+.^_` + "`" + `|~0-9A-Za-z-]+$`)

type AuthStatus struct {
	IsAuthenticated bool   `json:"isAuthenticated"`
	AuthType        string `json:"authType"`
	Host            string `json:"host"`
	Login           string `json:"login"`
	StatusMessage   string `json:"statusMessage"`
}

type Model struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	PolicyState string `json:"-"`
}

type Protocol string

const (
	ProtocolOpenAIChat      Protocol = "openai_chat"
	ProtocolOpenAIResponses Protocol = "openai_responses"
	ProtocolAnthropic       Protocol = "anthropic"
)

type SessionToken struct {
	Token  string
	Header string
}

type Endpoint struct {
	Type         string
	WireAPI      string
	BaseURL      string
	APIKey       string
	Headers      map[string]string
	SessionToken *SessionToken
	ExpiresAt    time.Time
}

func (e *Endpoint) Protocol() (Protocol, error) {
	if e == nil {
		return "", errors.New("Copilot endpoint is unavailable")
	}
	switch strings.ToLower(strings.TrimSpace(e.Type)) {
	case "anthropic":
		return ProtocolAnthropic, nil
	case "openai":
		switch strings.ToLower(strings.TrimSpace(e.WireAPI)) {
		case "responses":
			return ProtocolOpenAIResponses, nil
		case "", "completions", "chat", "chat_completions", "chat-completions":
			return ProtocolOpenAIChat, nil
		default:
			return "", fmt.Errorf("Copilot returned unsupported OpenAI wire API %q", e.WireAPI)
		}
	case "azure":
		return "", errors.New("Copilot Azure endpoints are not supported")
	default:
		return "", fmt.Errorf("Copilot returned unsupported endpoint type %q", e.Type)
	}
}

type cliRuntime struct {
	profileID string
	profile   string

	processMu sync.Mutex
	cmd       *exec.Cmd
	rpc       *rpcClient
	auth      AuthStatus

	sessionMu sync.Mutex
	sessions  map[string]string
	endpoints map[string]*Endpoint
	models    []Model
	modelsAt  time.Time
}

type runtimeManager struct {
	runtimes sync.Map
}

var copilotManager = &runtimeManager{}

func (m *runtimeManager) runtime(profileID string) (*cliRuntime, error) {
	canonical, err := canonicalProfileID(profileID)
	if err != nil {
		return nil, err
	}
	if value, ok := m.runtimes.Load(canonical); ok {
		return value.(*cliRuntime), nil
	}
	dir, err := profileDir(canonical)
	if err != nil {
		return nil, err
	}
	runtime := &cliRuntime{
		profileID: canonical,
		profile:   dir,
		sessions:  make(map[string]string),
		endpoints: make(map[string]*Endpoint),
	}
	actual, _ := m.runtimes.LoadOrStore(canonical, runtime)
	return actual.(*cliRuntime), nil
}

func (m *runtimeManager) stop(profileID string) {
	if value, ok := m.runtimes.LoadAndDelete(strings.TrimSpace(profileID)); ok {
		value.(*cliRuntime).stopProcess()
	}
}

func (r *cliRuntime) stopProcess() {
	r.processMu.Lock()
	defer r.processMu.Unlock()
	r.stopProcessLocked()
}

func (r *cliRuntime) stopProcessLocked() {
	if r.rpc != nil {
		r.rpc.Close()
		r.rpc = nil
	}
	if r.cmd != nil && r.cmd.Process != nil {
		_ = r.cmd.Process.Kill()
	}
	r.cmd = nil
	r.auth = AuthStatus{}
	r.sessionMu.Lock()
	clear(r.sessions)
	clear(r.endpoints)
	r.models = nil
	r.modelsAt = time.Time{}
	r.sessionMu.Unlock()
}

func (r *cliRuntime) ensureProcess(ctx context.Context) (*rpcClient, AuthStatus, error) {
	r.processMu.Lock()
	defer r.processMu.Unlock()
	if r.rpc != nil && !r.rpc.IsClosed() {
		return r.rpc, r.auth, nil
	}
	r.stopProcessLocked()
	if err := ensureRuntimeDirs(); err != nil {
		return nil, AuthStatus{}, err
	}
	if err := os.MkdirAll(r.profile, 0o700); err != nil {
		return nil, AuthStatus{}, fmt.Errorf("create Copilot profile directory: %w", err)
	}
	if err := writeProfileSettings(r.profile); err != nil {
		return nil, AuthStatus{}, err
	}
	path, err := cliPath()
	if err != nil {
		return nil, AuthStatus{}, err
	}
	cmd := exec.Command(path, "--headless", "--no-auto-update", "--disable-builtin-mcps", "--log-level", "error", "--stdio")
	cmd.Dir = workDir()
	cmd.Env = isolatedEnvironment(r.profile)
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, AuthStatus{}, fmt.Errorf("open Copilot CLI stdout: %w", err)
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		return nil, AuthStatus{}, fmt.Errorf("open Copilot CLI stderr: %w", err)
	}
	stdin, err := cmd.StdinPipe()
	if err != nil {
		return nil, AuthStatus{}, fmt.Errorf("open Copilot CLI stdin: %w", err)
	}
	if err := cmd.Start(); err != nil {
		return nil, AuthStatus{}, fmt.Errorf("start GitHub Copilot CLI: %w", err)
	}
	go func() { _, _ = io.Copy(io.Discard, stderr) }()
	client := newRPCClient(stdin, stdout)
	r.rpc = client
	r.cmd = cmd
	go r.waitForProcess(cmd, client)

	handshakeCtx, cancel := context.WithTimeout(ctx, rpcTimeout)
	defer cancel()
	var handshake struct {
		OK              bool     `json:"ok"`
		ProtocolVersion int      `json:"protocolVersion"`
		Version         string   `json:"version"`
		TaskKinds       []string `json:"taskKinds"`
	}
	if err := client.Call(handshakeCtx, "connect", map[string]any{
		"supportedTaskKinds": []string{"agent", "client", "shell"},
	}, &handshake); err != nil {
		r.stopProcessLocked()
		return nil, AuthStatus{}, fmt.Errorf("connect to GitHub Copilot CLI: %w", err)
	}
	if !handshake.OK {
		r.stopProcessLocked()
		return nil, AuthStatus{}, errors.New("GitHub Copilot CLI rejected the connection")
	}
	if strings.TrimSpace(handshake.Version) != DefaultCLIVersion {
		r.stopProcessLocked()
		return nil, AuthStatus{}, fmt.Errorf("GitHub Copilot CLI version %s is required", DefaultCLIVersion)
	}
	status, err := r.authStatusLocked(ctx, client)
	if err != nil {
		r.stopProcessLocked()
		return nil, AuthStatus{}, err
	}
	if !status.IsAuthenticated {
		r.stopProcessLocked()
		return nil, AuthStatus{}, errors.New("GitHub Copilot is signed out; connect a GitHub account in the channel settings")
	}
	r.auth = status
	return client, status, nil
}

func (r *cliRuntime) waitForProcess(cmd *exec.Cmd, client *rpcClient) {
	_ = cmd.Wait()
	client.Close()
	r.processMu.Lock()
	if r.cmd == cmd {
		r.rpc = nil
		r.cmd = nil
		r.auth = AuthStatus{}
		r.sessionMu.Lock()
		clear(r.sessions)
		clear(r.endpoints)
		r.models = nil
		r.modelsAt = time.Time{}
		r.sessionMu.Unlock()
	}
	r.processMu.Unlock()
}

func (r *cliRuntime) authStatusLocked(ctx context.Context, client *rpcClient) (AuthStatus, error) {
	var status AuthStatus
	callCtx, cancel := context.WithTimeout(ctx, rpcTimeout)
	defer cancel()
	if err := client.Call(callCtx, "auth.getStatus", map[string]any{}, &status); err != nil {
		return AuthStatus{}, fmt.Errorf("read GitHub Copilot authentication status: %w", err)
	}
	if status.IsAuthenticated && status.AuthType != "" && status.AuthType != "user" && status.AuthType != "gh-cli" {
		return AuthStatus{}, fmt.Errorf("GitHub Copilot authentication type %q is not supported", status.AuthType)
	}
	return status, nil
}

func (r *cliRuntime) call(ctx context.Context, method string, params any, result any) error {
	for range 2 {
		client, _, err := r.ensureProcess(ctx)
		if err != nil {
			return err
		}
		callCtx, cancel := context.WithTimeout(ctx, rpcTimeout)
		err = client.Call(callCtx, method, params, result)
		cancel()
		if err == nil {
			return nil
		}
		if !errors.Is(err, errRPCClosed) && !client.IsClosed() {
			return err
		}
	}
	return errRPCClosed
}

func (r *cliRuntime) identity(ctx context.Context) (AuthStatus, error) {
	_, status, err := r.ensureProcess(ctx)
	return status, err
}

func checkIdentity(status AuthStatus, expectedLogin string) error {
	if !status.IsAuthenticated {
		return errors.New("GitHub Copilot is signed out; reconnect the account")
	}
	if strings.TrimSpace(status.Login) == "" {
		return errors.New("GitHub Copilot did not return the signed-in account")
	}
	if expected := strings.TrimSpace(expectedLogin); expected != "" && !strings.EqualFold(expected, status.Login) {
		return fmt.Errorf("GitHub Copilot profile is signed in as %s, but the channel expects %s; reconnect the account", status.Login, expected)
	}
	return nil
}

type rawModel struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Policy *struct {
		State string `json:"state"`
	} `json:"policy"`
}

type modelsListResult struct {
	Models []rawModel `json:"models"`
}

func (r *cliRuntime) listModels(ctx context.Context) ([]Model, error) {
	r.sessionMu.Lock()
	if len(r.models) > 0 && time.Since(r.modelsAt) < modelsCacheTTL {
		models := append([]Model(nil), r.models...)
		r.sessionMu.Unlock()
		return models, nil
	}
	r.sessionMu.Unlock()

	var result modelsListResult
	if err := r.call(ctx, "models.list", map[string]any{}, &result); err != nil {
		return nil, err
	}
	seen := make(map[string]struct{}, len(result.Models))
	models := make([]Model, 0, len(result.Models))
	for _, item := range result.Models {
		id := strings.TrimSpace(item.ID)
		if id == "" || strings.EqualFold(id, "auto") {
			continue
		}
		if item.Policy != nil && strings.TrimSpace(item.Policy.State) != "" && !strings.EqualFold(item.Policy.State, "enabled") {
			continue
		}
		if _, exists := seen[id]; exists {
			return nil, fmt.Errorf("GitHub Copilot returned duplicate model identifier %q", id)
		}
		seen[id] = struct{}{}
		models = append(models, Model{ID: id, Name: strings.TrimSpace(item.Name)})
	}
	if len(models) == 0 {
		return nil, errors.New("this GitHub account exposes no enabled Copilot models")
	}
	r.sessionMu.Lock()
	r.models = append([]Model(nil), models...)
	r.modelsAt = time.Now()
	r.sessionMu.Unlock()
	return models, nil
}

func (r *cliRuntime) ensureSession(ctx context.Context, model string) (string, error) {
	r.sessionMu.Lock()
	if sessionID := r.sessions[model]; sessionID != "" {
		r.sessionMu.Unlock()
		return sessionID, nil
	}
	r.sessionMu.Unlock()

	sessionID := uuid.NewString()
	configDir := filepath.Join(workDir(), sessionID)
	if err := os.MkdirAll(configDir, 0o700); err != nil {
		return "", fmt.Errorf("create Copilot session directory: %w", err)
	}
	params := map[string]any{
		"model":                              model,
		"sessionId":                          sessionID,
		"workingDirectory":                   workDir(),
		"configDir":                          configDir,
		"streaming":                          false,
		"availableTools":                     []string{},
		"requestPermission":                  false,
		"requestUserInput":                   false,
		"requestElicitation":                 false,
		"requestExitPlanMode":                false,
		"requestAutoModeSwitch":              false,
		"enableConfigDiscovery":              false,
		"skipCustomInstructions":             true,
		"customAgentsLocalOnly":              true,
		"enableFileHooks":                    false,
		"enableOnDemandInstructionDiscovery": false,
		"enableHostGitOperations":            false,
		"enableSkills":                       false,
		"includedBuiltinSkills":              []string{},
		"requestExtensions":                  false,
		"enableSessionStore":                 false,
		"infiniteSessions":                   map[string]any{"enabled": false},
		"memory":                             map[string]any{"enabled": false},
		"skipEmbeddingRetrieval":             true,
		"embeddingCacheStorage":              "in-memory",
		"mcpOAuthTokenStorage":               "in-memory",
		"enableSessionTelemetry":             false,
		"envValueMode":                       "direct",
		"capi":                               map[string]any{"enableWebSocketResponses": false},
	}
	var result struct {
		SessionID string `json:"sessionId"`
	}
	if err := r.call(ctx, "session.create", params, &result); err != nil {
		_ = os.RemoveAll(configDir)
		return "", err
	}
	actualSessionID := strings.TrimSpace(result.SessionID)
	if actualSessionID == "" {
		_ = os.RemoveAll(configDir)
		return "", errors.New("GitHub Copilot did not create a session")
	}
	r.sessionMu.Lock()
	r.sessions[model] = actualSessionID
	r.sessionMu.Unlock()
	if actualSessionID != sessionID {
		_ = os.RemoveAll(configDir)
	}
	return actualSessionID, nil
}

type endpointWire struct {
	Type         string            `json:"type"`
	WireAPI      string            `json:"wireApi"`
	Transport    string            `json:"transport"`
	BaseURL      string            `json:"baseUrl"`
	APIKey       string            `json:"apiKey"`
	Headers      map[string]string `json:"headers"`
	ExpiresAt    string            `json:"expiresAt"`
	SessionToken *struct {
		Token     string `json:"token"`
		Header    string `json:"header"`
		Model     string `json:"model"`
		ExpiresAt string `json:"expiresAt"`
	} `json:"sessionToken"`
}

func (r *cliRuntime) endpoint(ctx context.Context, model string, forceRefresh bool) (*Endpoint, error) {
	r.sessionMu.Lock()
	if !forceRefresh {
		if cached := r.endpoints[model]; cached != nil {
			if cached.ExpiresAt.IsZero() || time.Until(cached.ExpiresAt) > endpointRefreshEarly {
				copy := cloneEndpoint(cached)
				r.sessionMu.Unlock()
				return copy, nil
			}
		}
	}
	r.sessionMu.Unlock()

	sessionID, err := r.ensureSession(ctx, model)
	if err != nil {
		return nil, err
	}
	var wire endpointWire
	if err := r.call(ctx, "session.provider.getEndpoint", map[string]any{
		"sessionId": sessionID,
		"modelId":   model,
	}, &wire); err != nil {
		return nil, err
	}
	endpoint, err := parseEndpoint(wire, model)
	if err != nil {
		return nil, err
	}
	if !endpoint.ExpiresAt.IsZero() && time.Now().After(endpoint.ExpiresAt) {
		return nil, errors.New("GitHub Copilot returned an expired endpoint; reconnect the account")
	}
	r.sessionMu.Lock()
	r.endpoints[model] = endpoint
	r.sessionMu.Unlock()
	return cloneEndpoint(endpoint), nil
}

func cloneEndpoint(endpoint *Endpoint) *Endpoint {
	if endpoint == nil {
		return nil
	}
	copy := *endpoint
	copy.Headers = make(map[string]string, len(endpoint.Headers))
	for key, value := range endpoint.Headers {
		copy.Headers[key] = value
	}
	if endpoint.SessionToken != nil {
		token := *endpoint.SessionToken
		copy.SessionToken = &token
	}
	return &copy
}

func parseEndpoint(wire endpointWire, model string) (*Endpoint, error) {
	transport := strings.ToLower(strings.TrimSpace(wire.Transport))
	if transport != "" && transport != "http" {
		return nil, fmt.Errorf("GitHub Copilot endpoint transport %q is not supported", wire.Transport)
	}
	baseURL := strings.TrimSpace(wire.BaseURL)
	parsedURL, err := url.Parse(baseURL)
	if err != nil || parsedURL.Scheme != "https" || parsedURL.Host == "" || parsedURL.User != nil || parsedURL.RawQuery != "" || parsedURL.Fragment != "" {
		return nil, errors.New("GitHub Copilot returned an invalid HTTPS endpoint URL")
	}
	headers := make(map[string]string, len(wire.Headers))
	for name, value := range wire.Headers {
		name = strings.TrimSpace(name)
		if !headerNamePattern.MatchString(name) || strings.ContainsAny(name+value, "\r\n\x00") {
			return nil, errors.New("GitHub Copilot returned an invalid endpoint header")
		}
		headers[name] = value
	}
	var token *SessionToken
	expiresAt, err := parseEndpointTime(wire.ExpiresAt)
	if err != nil {
		return nil, errors.New("GitHub Copilot returned an invalid endpoint expiry")
	}
	if wire.SessionToken != nil && strings.TrimSpace(wire.SessionToken.Token) != "" {
		header := strings.TrimSpace(wire.SessionToken.Header)
		if !headerNamePattern.MatchString(header) || strings.ContainsAny(wire.SessionToken.Token, "\r\n\x00") {
			return nil, errors.New("GitHub Copilot returned an invalid session token header")
		}
		if tokenModel := strings.TrimSpace(wire.SessionToken.Model); tokenModel != "" && tokenModel != model {
			return nil, errors.New("GitHub Copilot returned a session token for a different model")
		}
		token = &SessionToken{Token: wire.SessionToken.Token, Header: header}
		sessionExpiry, err := parseEndpointTime(wire.SessionToken.ExpiresAt)
		if err != nil {
			return nil, errors.New("GitHub Copilot returned an invalid session token expiry")
		}
		if !sessionExpiry.IsZero() {
			expiresAt = sessionExpiry
		}
	}
	if strings.ContainsAny(wire.APIKey, "\r\n\x00") {
		return nil, errors.New("GitHub Copilot returned an invalid endpoint credential")
	}
	return &Endpoint{
		Type:         strings.TrimSpace(wire.Type),
		WireAPI:      strings.TrimSpace(wire.WireAPI),
		BaseURL:      strings.TrimRight(baseURL, "/"),
		APIKey:       strings.TrimSpace(wire.APIKey),
		Headers:      headers,
		SessionToken: token,
		ExpiresAt:    expiresAt,
	}, nil
}

func parseEndpointTime(raw string) (time.Time, error) {
	value := strings.TrimSpace(raw)
	if value == "" {
		return time.Time{}, nil
	}
	parsed, err := time.Parse(time.RFC3339Nano, value)
	if err != nil {
		return time.Time{}, err
	}
	return parsed, nil
}

func GetModels(ctx context.Context, key ChannelKey) ([]string, error) {
	runtime, err := copilotManager.runtime(key.ProfileID)
	if err != nil {
		return nil, err
	}
	status, err := runtime.identity(ctx)
	if err != nil {
		return nil, err
	}
	if err := checkIdentity(status, key.Login); err != nil {
		return nil, err
	}
	models, err := runtime.listModels(ctx)
	if err != nil {
		return nil, err
	}
	status, err = runtime.identity(ctx)
	if err != nil {
		return nil, err
	}
	if err := checkIdentity(status, key.Login); err != nil {
		return nil, err
	}
	ids := make([]string, 0, len(models))
	for _, model := range models {
		ids = append(ids, model.ID)
	}
	return ids, nil
}

func GetEndpoint(ctx context.Context, key ChannelKey, model string, forceRefresh bool) (*Endpoint, error) {
	if strings.TrimSpace(model) == "" {
		return nil, errors.New("model is required for GitHub Copilot")
	}
	runtime, err := copilotManager.runtime(key.ProfileID)
	if err != nil {
		return nil, err
	}
	status, err := runtime.identity(ctx)
	if err != nil {
		return nil, err
	}
	if err := checkIdentity(status, key.Login); err != nil {
		return nil, err
	}
	endpoint, err := runtime.endpoint(ctx, model, forceRefresh)
	if err != nil {
		return nil, err
	}
	status, err = runtime.identity(ctx)
	if err != nil {
		return nil, err
	}
	if err := checkIdentity(status, key.Login); err != nil {
		return nil, err
	}
	return endpoint, nil
}

func InvalidateEndpoint(key ChannelKey, model string) {
	runtime, err := copilotManager.runtime(key.ProfileID)
	if err != nil {
		return
	}
	runtime.sessionMu.Lock()
	delete(runtime.endpoints, model)
	runtime.sessionMu.Unlock()
}

func AuthStatusForProfile(ctx context.Context, profileID string) (AuthStatus, error) {
	runtime, err := copilotManager.runtime(profileID)
	if err != nil {
		return AuthStatus{}, err
	}
	return runtime.identity(ctx)
}

func StopProfile(profileID string) {
	copilotManager.stop(profileID)
}

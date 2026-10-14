package smartrouterhost

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"io"
	"mime"
	"net"
	"net/http"
	"net/url"
	"reflect"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
)

type RegistryEntry struct {
	BindingID      string `json:"binding_id"`
	ChannelID      int    `json:"channel_id"`
	Group          string `json:"group"`
	Model          string `json:"model"`
	Protocol       string `json:"protocol"`
	ProtocolPlugin string `json:"protocol_plugin"`
}

type Config struct {
	Enabled      bool
	URL          string
	SigningKey   []byte
	Timeout      time.Duration
	AttemptLimit int
	Bindings     []RegistryEntry
}

const maximumBody = 1 << 20

var (
	ErrConfig           = errors.New("smart_router: invalid_config")
	ErrDisabled         = errors.New("smart_router: disabled")
	ErrRequest          = errors.New("smart_router: invalid_request")
	ErrResponse         = errors.New("smart_router: invalid_response")
	ErrSignature        = errors.New("smart_router: signature_invalid")
	ErrExpired          = errors.New("smart_router: snapshot_expired")
	ErrTransport        = errors.New("smart_router: transport_failed")
	ErrResponseTooLarge = errors.New("smart_router: response_too_large")
	bindingIDPattern    = regexp.MustCompile(`^bnd_[A-Za-z0-9_-]{24}$`)
	hashPattern         = regexp.MustCompile(`^[0-9a-f]{64}$`)
)

type Client struct {
	enabled bool
	url     string
	key     []byte
	timeout time.Duration
	now     func() time.Time
	http    *http.Client
}

func LoadConfig(lookup func(string) string) (Config, error) {
	if lookup == nil {
		return Config{}, ErrConfig
	}
	switch lookup("NEWAPI_SMART_ROUTER_ENABLED") {
	case "", "false":
		return Config{}, nil
	case "true":
	default:
		return Config{}, ErrConfig
	}
	config := Config{
		Enabled: true, URL: lookup("NEWAPI_SMART_ROUTER_URL"),
		SigningKey: []byte(lookup("NEWAPI_SMART_ROUTER_SIGNING_KEY")),
		Timeout:    2 * time.Second, AttemptLimit: 2,
	}
	if raw := lookup("NEWAPI_SMART_ROUTER_TIMEOUT"); raw != "" {
		var err error
		config.Timeout, err = time.ParseDuration(raw)
		if err != nil {
			return Config{}, ErrConfig
		}
	}
	if raw := lookup("NEWAPI_SMART_ROUTER_ATTEMPT_LIMIT"); raw != "" {
		var err error
		config.AttemptLimit, err = strconv.Atoi(raw)
		if err != nil {
			return Config{}, ErrConfig
		}
	}
	raw := lookup("NEWAPI_SMART_ROUTER_BINDINGS")
	if len(raw) > maximumBody || decodeStrict([]byte(raw), &config.Bindings) != nil {
		return Config{}, ErrConfig
	}
	if validateConfig(config) != nil {
		return Config{}, ErrConfig
	}
	return config, nil
}

func validateConfig(config Config) error {
	u, err := url.Parse(config.URL)
	if err != nil || u.Scheme != "http" || u.Opaque != "" || u.User != nil ||
		strings.ContainsAny(config.URL, "?#") || u.RawPath != "" ||
		(u.Path != "" && u.Path != "/") {
		return ErrConfig
	}
	host, port, err := net.SplitHostPort(u.Host)
	if err != nil || (host != "127.0.0.1" && host != "::1") || port == "" {
		return ErrConfig
	}
	for _, digit := range port {
		if digit < '0' || digit > '9' {
			return ErrConfig
		}
	}
	number, err := strconv.Atoi(port)
	if err != nil || number < 1 || number > 65535 {
		return ErrConfig
	}
	if len(config.SigningKey) < 32 || config.Timeout <= 0 || config.Timeout > 10*time.Second ||
		config.AttemptLimit < 1 || config.AttemptLimit > 5 || len(config.Bindings) < 1 || len(config.Bindings) > 256 {
		return ErrConfig
	}
	ids := make(map[string]bool, len(config.Bindings))
	tuples := make(map[[3]string]int)
	for _, entry := range config.Bindings {
		if !bindingIDPattern.MatchString(entry.BindingID) || ids[entry.BindingID] || entry.ChannelID <= 0 ||
			!bounded(entry.Group, 128) || !bounded(entry.Model, 256) ||
			protocolPlugin(Protocol(entry.Protocol)) == "" || protocolPlugin(Protocol(entry.Protocol)) != entry.ProtocolPlugin {
			return ErrConfig
		}
		ids[entry.BindingID] = true
		tuple := [3]string{entry.Group, entry.Model, entry.Protocol}
		tuples[tuple]++
		if tuples[tuple] > 5 {
			return ErrConfig
		}
	}
	return nil
}

func NewClient(config Config, now func() time.Time) (*Client, error) {
	if !config.Enabled {
		return &Client{}, nil
	}
	if validateConfig(config) != nil {
		return nil, ErrConfig
	}
	if now == nil {
		now = time.Now
	}
	dialer := &net.Dialer{Timeout: config.Timeout}
	return &Client{
		enabled: true, url: strings.TrimSuffix(config.URL, "/"),
		key: bytes.Clone(config.SigningKey), timeout: config.Timeout, now: now,
		http: &http.Client{
			Timeout:   config.Timeout,
			Transport: &http.Transport{Proxy: nil, DialContext: dialer.DialContext, DisableKeepAlives: true},
			CheckRedirect: func(*http.Request, []*http.Request) error {
				return ErrTransport
			},
		},
	}, nil
}

func (c *Client) Route(ctx context.Context, request RouteRequest) (RouteResponse, error) {
	if !c.enabled {
		return RouteResponse{}, ErrDisabled
	}
	if request.Kind != "route_request" || request.SchemaVersion != 1 || !bounded(request.RequestID, 128) ||
		!bounded(request.Group, 128) || !bounded(request.Model, 256) || len(request.SnapshotRevision) > 128 ||
		request.AttemptLimit < 1 || request.AttemptLimit > 5 || validateBindings(request.Bindings, request.Protocol) != nil {
		return RouteResponse{}, ErrRequest
	}
	payload, err := common.Marshal(request)
	if err != nil {
		return RouteResponse{}, ErrRequest
	}
	body, err := c.call(ctx, http.MethodPost, "/v1/route", payload, http.StatusOK)
	if err != nil {
		return RouteResponse{}, err
	}
	var response RouteResponse
	if decodeStrict(body, &response) != nil {
		return RouteResponse{}, ErrResponse
	}
	if c.verifySignature(response, response.Signature) != nil {
		return RouteResponse{}, ErrSignature
	}
	if response.Kind != "route_response" || response.SchemaVersion != 1 || response.RequestID != request.RequestID ||
		!bounded(response.SnapshotRevision, 128) || response.ExpiresAt < 1 || len(response.Bindings) > min(request.AttemptLimit, 5) ||
		validateBindings(response.Bindings, request.Protocol) != nil {
		return RouteResponse{}, ErrResponse
	}
	if c.now().UnixMilli() >= response.ExpiresAt {
		return RouteResponse{}, ErrExpired
	}
	eligible := make(map[string]bool, len(request.Bindings))
	for _, binding := range request.Bindings {
		eligible[binding.BindingID] = true
	}
	for _, binding := range response.Bindings {
		if !eligible[binding.BindingID] {
			return RouteResponse{}, ErrResponse
		}
	}
	return response, nil
}

func (c *Client) ReportOutcome(ctx context.Context, outcome AttemptOutcome) error {
	if !c.enabled {
		return ErrDisabled
	}
	if outcome.Kind != "attempt_outcome" || outcome.SchemaVersion != 1 || !bounded(outcome.EventID, 128) ||
		!bounded(outcome.RequestID, 128) || !bindingIDPattern.MatchString(outcome.BindingID) ||
		protocolPlugin(outcome.Protocol) == "" || outcome.LatencyMS < 0 || outcome.TTFTMS < 0 ||
		outcome.RetryAfterMS < 0 || outcome.RetryAfterMS > MaximumRetryAfterMS {
		return ErrRequest
	}
	switch outcome.Outcome {
	case OutcomeSuccess, OutcomeAuth401, OutcomeRateLimited429, OutcomeUpstream5xx, OutcomeClient4xx,
		OutcomeTransportPreWrite, OutcomeWriteUnknown, OutcomeResponseCommitted:
	default:
		return ErrRequest
	}
	payload, err := common.Marshal(outcome)
	if err != nil {
		return ErrRequest
	}
	_, err = c.call(ctx, http.MethodPost, "/v1/outcomes", payload, http.StatusNoContent)
	return err
}

func (c *Client) Snapshot(ctx context.Context) (SignedSnapshot, error) {
	if !c.enabled {
		return SignedSnapshot{}, ErrDisabled
	}
	body, err := c.call(ctx, http.MethodGet, "/v1/snapshot", nil, http.StatusOK)
	if err != nil {
		return SignedSnapshot{}, err
	}
	var snapshot SignedSnapshot
	if decodeStrict(body, &snapshot) != nil {
		return SignedSnapshot{}, ErrResponse
	}
	if c.verifySignature(snapshot, snapshot.Signature) != nil {
		return SignedSnapshot{}, ErrSignature
	}
	if snapshot.Kind != "signed_snapshot" || snapshot.SchemaVersion != 1 || !bounded(snapshot.Revision, 128) ||
		!hashPattern.MatchString(snapshot.ConfigSHA256) || !hashPattern.MatchString(snapshot.PluginManifestSHA256) ||
		snapshot.IssuedAt < 1 || snapshot.ExpiresAt < 1 || snapshot.ExpiresAt <= snapshot.IssuedAt {
		return SignedSnapshot{}, ErrResponse
	}
	now := c.now().UnixMilli()
	if snapshot.IssuedAt > now || now >= snapshot.ExpiresAt {
		return SignedSnapshot{}, ErrExpired
	}
	tuples := make(map[[3]string]bool, len(snapshot.Routes))
	for _, route := range snapshot.Routes {
		tuple := [3]string{route.Group, route.Model, string(route.Protocol)}
		if tuples[tuple] || !bounded(route.Group, 128) || !bounded(route.Model, 256) ||
			validateBindings(route.Bindings, route.Protocol) != nil {
			return SignedSnapshot{}, ErrResponse
		}
		tuples[tuple] = true
	}
	return snapshot, nil
}

// Canonicalize typed JSON without converting numeric lexemes through float64.
func CanonicalPayload(value any) ([]byte, error) {
	data, err := common.Marshal(value)
	if err != nil {
		return nil, ErrResponse
	}
	data = bytes.TrimSpace(data)
	if len(data) == 0 || data[0] != '{' {
		return nil, ErrResponse
	}
	return canonicalJSON(data, 0)
}

func canonicalJSON(data []byte, depth int) ([]byte, error) {
	if depth > 64 {
		return nil, ErrResponse
	}
	data = bytes.TrimSpace(data)
	switch data[0] {
	case '{':
		var fields map[string]common.RawMessage
		if common.Unmarshal(data, &fields) != nil {
			return nil, ErrResponse
		}
		if depth == 0 {
			delete(fields, "signature")
		}
		for name, value := range fields {
			normalized, err := canonicalJSON(value, depth+1)
			if err != nil {
				return nil, err
			}
			fields[name] = normalized
		}
		data, err := common.Marshal(fields)
		if err != nil {
			return nil, ErrResponse
		}
		return data, nil
	case '[':
		var values []common.RawMessage
		if common.Unmarshal(data, &values) != nil {
			return nil, ErrResponse
		}
		for i, value := range values {
			normalized, err := canonicalJSON(value, depth+1)
			if err != nil {
				return nil, err
			}
			values[i] = normalized
		}
		data, err := common.Marshal(values)
		if err != nil {
			return nil, ErrResponse
		}
		return data, nil
	case '"':
		var value string
		if common.Unmarshal(data, &value) != nil {
			return nil, ErrResponse
		}
		data, err := common.Marshal(value)
		if err != nil {
			return nil, ErrResponse
		}
		return data, nil
	default:
		return bytes.Clone(data), nil
	}
}

func (c *Client) verifySignature(value any, signature string) error {
	if len(signature) != 43 {
		return ErrSignature
	}
	digest, err := base64.RawURLEncoding.Strict().DecodeString(signature)
	if err != nil || len(digest) != sha256.Size {
		return ErrSignature
	}
	payload, err := CanonicalPayload(value)
	if err != nil {
		return ErrSignature
	}
	mac := hmac.New(sha256.New, c.key)
	_, _ = mac.Write(payload)
	if !hmac.Equal(mac.Sum(nil), digest) {
		return ErrSignature
	}
	return nil
}

func validateBindings(bindings []Binding, protocol Protocol) error {
	plugin := protocolPlugin(protocol)
	if plugin == "" || len(bindings) < 1 || len(bindings) > 5 {
		return ErrResponse
	}
	seen := make(map[string]bool, len(bindings))
	for i, binding := range bindings {
		if !bindingIDPattern.MatchString(binding.BindingID) || seen[binding.BindingID] ||
			binding.ProtocolPlugin != plugin || binding.Rank != i+1 || binding.CostMicrounits < 0 {
			return ErrResponse
		}
		seen[binding.BindingID] = true
	}
	return nil
}

// Each control operation makes one request, including after ambiguous writes.
func (c *Client) call(ctx context.Context, method, path string, payload []byte, success int) ([]byte, error) {
	if ctx == nil {
		return nil, ErrRequest
	}
	ctx, cancel := context.WithTimeout(ctx, c.timeout)
	defer cancel()
	request, err := http.NewRequestWithContext(ctx, method, c.url+path, bytes.NewReader(payload))
	if err != nil {
		return nil, ErrRequest
	}
	request.Header.Set("Content-Type", "application/json")
	response, err := c.http.Do(request)
	if err != nil {
		if ctx.Err() != nil {
			return nil, ctx.Err()
		}
		if errors.Is(err, context.DeadlineExceeded) {
			return nil, context.DeadlineExceeded
		}
		return nil, ErrTransport
	}
	defer response.Body.Close()
	body, err := io.ReadAll(io.LimitReader(response.Body, maximumBody+1))
	if err != nil {
		if ctx.Err() != nil {
			return nil, ctx.Err()
		}
		if errors.Is(err, context.DeadlineExceeded) {
			return nil, context.DeadlineExceeded
		}
		return nil, ErrTransport
	}
	if len(body) > maximumBody {
		return nil, ErrResponseTooLarge
	}
	if response.StatusCode == success && success == http.StatusNoContent {
		if len(body) != 0 || response.ContentLength > 0 ||
			len(response.TransferEncoding) != 0 ||
			(response.Header.Get("Content-Length") != "" && response.Header.Get("Content-Length") != "0") {
			return nil, ErrResponse
		}
		return body, nil
	}
	contentType, _, err := mime.ParseMediaType(response.Header.Get("Content-Type"))
	if err != nil || contentType != "application/json" {
		return nil, ErrResponse
	}
	if response.StatusCode == success {
		return body, nil
	}
	var contract ContractError
	if decodeStrict(body, &contract) != nil || !contract.validForStatus(response.StatusCode) {
		return nil, ErrResponse
	}
	contract.Message = ""
	return nil, contract
}

func bounded(value string, maximum int) bool { return len(value) >= 1 && len(value) <= maximum }

func protocolPlugin(protocol Protocol) string {
	switch protocol {
	case ProtocolChat:
		return "chat-v1"
	case ProtocolResponses:
		return "responses-v1"
	case ProtocolMessages:
		return "messages-v1"
	default:
		return ""
	}
}

// The codec validates syntax; the token walk retains duplicate names that maps lose.
func decodeStrict(data []byte, dst any) error {
	var raw common.RawMessage
	if common.Unmarshal(data, &raw) != nil {
		return ErrResponse
	}
	scanner := jsonFieldScanner{data: data}
	if scanner.value() != nil || validateWireShape(data, reflect.TypeOf(dst).Elem()) != nil ||
		common.Unmarshal(data, dst) != nil {
		return ErrResponse
	}
	return nil
}

type jsonFieldScanner struct {
	data  []byte
	pos   int
	depth int
}

func (s *jsonFieldScanner) space() {
	for s.pos < len(s.data) && (s.data[s.pos] == ' ' || s.data[s.pos] == '\n' || s.data[s.pos] == '\r' || s.data[s.pos] == '\t') {
		s.pos++
	}
}

func (s *jsonFieldScanner) stringToken() []byte {
	start := s.pos
	s.pos++
	for s.pos < len(s.data) {
		ch := s.data[s.pos]
		s.pos++
		if ch == '\\' {
			s.pos++
		} else if ch == '"' {
			break
		}
	}
	return s.data[start:s.pos]
}

func (s *jsonFieldScanner) value() error {
	if s.depth > 64 {
		return ErrResponse
	}
	s.depth++
	defer func() { s.depth-- }()
	s.space()
	switch s.data[s.pos] {
	case '{':
		s.pos++
		s.space()
		seen := make(map[string]bool)
		if s.data[s.pos] == '}' {
			s.pos++
			return nil
		}
		for {
			var name string
			if common.Unmarshal(s.stringToken(), &name) != nil || seen[name] {
				return ErrResponse
			}
			seen[name] = true
			s.space()
			s.pos++ // colon, already syntax-validated by the codec
			if s.value() != nil {
				return ErrResponse
			}
			s.space()
			ch := s.data[s.pos]
			s.pos++
			if ch == '}' {
				return nil
			}
			s.space()
		}
	case '[':
		s.pos++
		s.space()
		if s.data[s.pos] == ']' {
			s.pos++
			return nil
		}
		for {
			if s.value() != nil {
				return ErrResponse
			}
			s.space()
			ch := s.data[s.pos]
			s.pos++
			if ch == ']' {
				return nil
			}
		}
	case '"':
		s.stringToken()
	default:
		for s.pos < len(s.data) && !strings.ContainsRune(",]} \r\n\t", rune(s.data[s.pos])) {
			s.pos++
		}
	}
	return nil
}

func validateWireShape(data []byte, schema reflect.Type) error {
	data = bytes.TrimSpace(data)
	if bytes.Equal(data, []byte("null")) {
		return ErrResponse
	}
	switch schema.Kind() {
	case reflect.Struct:
		var fields map[string]common.RawMessage
		if common.Unmarshal(data, &fields) != nil || fields == nil {
			return ErrResponse
		}
		for i := range schema.NumField() {
			field := schema.Field(i)
			name, option, _ := strings.Cut(field.Tag.Get("json"), ",")
			value, exists := fields[name]
			if !exists {
				if option == "omitempty" {
					continue
				}
				return ErrResponse
			}
			if validateWireShape(value, field.Type) != nil {
				return ErrResponse
			}
			delete(fields, name)
		}
		if len(fields) != 0 {
			return ErrResponse
		}
	case reflect.Slice:
		var values []common.RawMessage
		if common.Unmarshal(data, &values) != nil || values == nil {
			return ErrResponse
		}
		for _, value := range values {
			if validateWireShape(value, schema.Elem()) != nil {
				return ErrResponse
			}
		}
	default:
		if common.Unmarshal(data, reflect.New(schema).Interface()) != nil {
			return ErrResponse
		}
	}
	return nil
}

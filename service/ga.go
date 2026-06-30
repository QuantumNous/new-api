package service

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/bytedance/gopkg/util/gopool"
)

const (
	defaultGAMeasurementID = "G-30RCEP2CVH"
	defaultGAEndpoint      = "https://www.google-analytics.com/mp/collect"
)

type GAConfig struct {
	MeasurementID string
	APISecret     string
	Endpoint      string
	HTTPClient    *http.Client
}

type GAEvent struct {
	Name      string
	ClientID  string
	SessionID string
	Params    map[string]any
}

type gaMeasurementPayload struct {
	ClientID string               `json:"client_id"`
	Events   []gaMeasurementEvent `json:"events"`
}

type gaMeasurementEvent struct {
	Name   string         `json:"name"`
	Params map[string]any `json:"params,omitempty"`
}

func DefaultGAConfig() GAConfig {
	measurementID := strings.TrimSpace(os.Getenv("GA_MESSUREMENT_ID"))
	if measurementID == "" {
		measurementID = defaultGAMeasurementID
	}
	return GAConfig{
		MeasurementID: measurementID,
		APISecret:     strings.TrimSpace(os.Getenv("GA_MEASURE_PROTOCOL_API_SECRET")),
		Endpoint:      defaultGAEndpoint,
		HTTPClient: &http.Client{
			Timeout: 3 * time.Second,
		},
	}
}

func SendGAEvent(ctx context.Context, event GAEvent) {
	cfg := DefaultGAConfig()
	event = snapshotGAEvent(event)
	gopool.Go(func() {
		if err := SendGAEventWithConfig(cfg, event); err != nil {
			logger.LogWarn(ctx, fmt.Sprintf("GA Measurement Protocol event failed event=%s error=%q", event.Name, err.Error()))
		}
	})
}

func snapshotGAEvent(event GAEvent) GAEvent {
	if event.Params == nil {
		return event
	}
	params := make(map[string]any, len(event.Params))
	for key, value := range event.Params {
		params[key] = value
	}
	event.Params = params
	return event
}

func NormalizeGAIdentifier(value string) string {
	value = strings.TrimSpace(value)
	if len(value) > 128 {
		return value[:128]
	}
	return value
}

func ResolveGAIdentifiers(req *http.Request, clientID string, sessionID string) (string, string) {
	clientID = NormalizeGAIdentifier(clientID)
	sessionID = NormalizeGAIdentifier(sessionID)
	if req == nil {
		return clientID, sessionID
	}
	if clientID == "" {
		clientID = parseGAClientIDFromCookie(cookieValue(req, "_ga"))
	}
	if sessionID == "" {
		cfg := DefaultGAConfig()
		cookieSuffix := strings.TrimPrefix(cfg.MeasurementID, "G-")
		cookieSuffix = strings.ReplaceAll(cookieSuffix, "-", "_")
		sessionID = parseGASessionIDFromCookie(cookieValue(req, "_ga_"+cookieSuffix))
	}
	return NormalizeGAIdentifier(clientID), NormalizeGAIdentifier(sessionID)
}

func cookieValue(req *http.Request, name string) string {
	cookie, err := req.Cookie(name)
	if err != nil {
		return ""
	}
	return cookie.Value
}

func parseGAClientIDFromCookie(value string) string {
	parts := strings.Split(value, ".")
	if len(parts) < 4 {
		return ""
	}
	clientID := strings.Join(parts[len(parts)-2:], ".")
	if strings.Count(clientID, ".") != 1 {
		return ""
	}
	for _, part := range strings.Split(clientID, ".") {
		if part == "" || strings.Trim(part, "0123456789") != "" {
			return ""
		}
	}
	return clientID
}

func parseGASessionIDFromCookie(value string) string {
	for _, segment := range strings.FieldsFunc(value, func(r rune) bool {
		return r == '.' || r == '$'
	}) {
		if len(segment) > 1 && segment[0] == 's' && strings.Trim(segment[1:], "0123456789") == "" {
			return segment[1:]
		}
	}
	parts := strings.Split(value, ".")
	if len(parts) >= 3 && strings.HasPrefix(parts[0], "GS") && strings.Trim(parts[2], "0123456789") == "" {
		return parts[2]
	}
	return ""
}

func SendGAEventWithConfig(cfg GAConfig, event GAEvent) error {
	cfg.MeasurementID = strings.TrimSpace(cfg.MeasurementID)
	cfg.APISecret = strings.TrimSpace(cfg.APISecret)
	cfg.Endpoint = strings.TrimSpace(cfg.Endpoint)
	event.Name = strings.TrimSpace(event.Name)
	event.ClientID = strings.TrimSpace(event.ClientID)
	event.SessionID = strings.TrimSpace(event.SessionID)

	if cfg.MeasurementID == "" || cfg.APISecret == "" {
		return nil
	}
	if event.Name == "" || event.ClientID == "" || event.SessionID == "" {
		return nil
	}
	if cfg.Endpoint == "" {
		cfg.Endpoint = defaultGAEndpoint
	}
	if cfg.HTTPClient == nil {
		cfg.HTTPClient = &http.Client{Timeout: 3 * time.Second}
	}

	collectURL, err := url.Parse(cfg.Endpoint)
	if err != nil {
		return fmt.Errorf("parse GA endpoint: %w", err)
	}
	query := collectURL.Query()
	query.Set("measurement_id", cfg.MeasurementID)
	query.Set("api_secret", cfg.APISecret)
	collectURL.RawQuery = query.Encode()

	params := map[string]any{
		"session_id":           event.SessionID,
		"engagement_time_msec": 1,
	}
	for key, value := range event.Params {
		key = strings.TrimSpace(key)
		if key == "" || value == nil {
			continue
		}
		params[key] = value
	}

	payload := gaMeasurementPayload{
		ClientID: event.ClientID,
		Events: []gaMeasurementEvent{{
			Name:   event.Name,
			Params: params,
		}},
	}
	body, err := common.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal GA payload: %w", err)
	}

	reqCtx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(reqCtx, http.MethodPost, collectURL.String(), bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("build GA request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := cfg.HTTPClient.Do(req)
	if err != nil {
		return fmt.Errorf("send GA request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return errors.New("GA Measurement Protocol returned " + resp.Status)
	}
	return nil
}

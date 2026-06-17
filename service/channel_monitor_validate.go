package service

import (
	"context"
	"net/url"
	"regexp"
	"strings"
)

func validateMonitorProvider(provider string) error {
	switch provider {
	case MonitorProviderOpenAI, MonitorProviderAnthropic, MonitorProviderGemini:
		return nil
	default:
		return ErrChannelMonitorInvalidProvider
	}
}

func validateMonitorAPIMode(provider, apiMode string) error {
	switch defaultMonitorAPIMode(apiMode) {
	case MonitorAPIModeChatCompletions:
		return nil
	case MonitorAPIModeResponses:
		if provider == "" || provider == MonitorProviderOpenAI {
			return nil
		}
	}
	return ErrChannelMonitorInvalidAPIMode
}

func defaultMonitorAPIMode(apiMode string) string {
	apiMode = strings.TrimSpace(apiMode)
	if apiMode == "" {
		return MonitorAPIModeChatCompletions
	}
	return apiMode
}

func validateMonitorInterval(seconds int) error {
	if seconds < monitorMinIntervalSeconds || seconds > monitorMaxIntervalSeconds {
		return ErrChannelMonitorInvalidInterval
	}
	return nil
}

func validateMonitorJitter(jitterSeconds, intervalSeconds int) error {
	if jitterSeconds < 0 || jitterSeconds > monitorMaxIntervalSeconds {
		return ErrChannelMonitorInvalidJitter
	}
	if intervalSeconds-jitterSeconds < monitorMinIntervalSeconds {
		return ErrChannelMonitorInvalidJitter
	}
	return nil
}

func validateMonitorEndpoint(endpoint string) error {
	endpoint = strings.TrimSpace(endpoint)
	if endpoint == "" {
		return ErrChannelMonitorInvalidEndpoint
	}
	u, err := url.Parse(endpoint)
	if err != nil {
		return ErrChannelMonitorInvalidEndpoint
	}
	if u.Scheme != "https" {
		return ErrChannelMonitorEndpointScheme
	}
	if u.Host == "" {
		return ErrChannelMonitorInvalidEndpoint
	}
	if u.Path != "" && u.Path != "/" {
		return ErrChannelMonitorEndpointPath
	}
	if u.RawQuery != "" || u.Fragment != "" {
		return ErrChannelMonitorEndpointPath
	}
	ctx, cancel := context.WithTimeout(context.Background(), monitorEndpointResolveTimeout)
	defer cancel()
	blocked, err := isMonitorPrivateOrLoopbackHost(ctx, u.Hostname())
	if err != nil {
		return ErrChannelMonitorEndpointUnreachable
	}
	if blocked {
		return ErrChannelMonitorEndpointPrivate
	}
	return nil
}

func normalizeMonitorEndpoint(endpoint string) string {
	return strings.TrimRight(strings.TrimSpace(endpoint), "/")
}

func normalizeMonitorModels(models []string) []string {
	if len(models) == 0 {
		return []string{}
	}
	out := make([]string, 0, len(models))
	seen := make(map[string]struct{}, len(models))
	for _, model := range models {
		model = strings.TrimSpace(model)
		if model == "" {
			continue
		}
		if _, ok := seen[model]; ok {
			continue
		}
		seen[model] = struct{}{}
		out = append(out, model)
	}
	return out
}

func validateBodyModeForProtocol(provider, apiMode, mode string, body map[string]any) error {
	if err := validateBodyModeParams(mode, body); err != nil {
		return err
	}
	if defaultBodyMode(mode) != MonitorBodyOverrideModeReplace {
		return nil
	}
	if err := validateReplaceRequestBody(provider, defaultMonitorAPIMode(apiMode), body); err != nil {
		return ErrChannelMonitorInvalidRequestBody
	}
	return nil
}

func validateBodyModeParams(mode string, body map[string]any) error {
	switch defaultBodyMode(mode) {
	case MonitorBodyOverrideModeOff:
		return nil
	case MonitorBodyOverrideModeMerge, MonitorBodyOverrideModeReplace:
		if len(body) == 0 {
			return ErrChannelMonitorTemplateBodyRequired
		}
		return nil
	default:
		return ErrChannelMonitorTemplateInvalidBodyMode
	}
}

var monitorHeaderNameRegex = regexp.MustCompile(`^[A-Za-z0-9!#$%&'*+\-.^_` + "`" + `|~]+$`)

var monitorForbiddenHeaderNames = map[string]bool{
	"host":              true,
	"content-length":    true,
	"content-encoding":  true,
	"transfer-encoding": true,
	"connection":        true,
}

func IsForbiddenHeaderName(name string) bool {
	return monitorForbiddenHeaderNames[strings.ToLower(strings.TrimSpace(name))]
}

func validateExtraHeaders(headers map[string]string) error {
	for name := range headers {
		name = strings.TrimSpace(name)
		if !monitorHeaderNameRegex.MatchString(name) {
			return ErrChannelMonitorTemplateHeaderInvalidName
		}
		if IsForbiddenHeaderName(name) {
			return ErrChannelMonitorTemplateHeaderForbidden
		}
	}
	return nil
}

func emptyMonitorHeadersIfNil(headers map[string]string) map[string]string {
	if headers == nil {
		return map[string]string{}
	}
	return headers
}

func defaultBodyMode(mode string) string {
	if strings.TrimSpace(mode) == "" {
		return MonitorBodyOverrideModeOff
	}
	return strings.TrimSpace(mode)
}

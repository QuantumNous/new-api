package model

import (
	"errors"
	"fmt"
	"net/url"
	"strings"
)

func validateCASProvider(provider *CustomOAuthProvider) error {
	if !isValidAbsoluteHTTPURL(provider.CASServerURL) {
		return errors.New("cas_server_url is required and must be a valid http/https url")
	}
	if strings.TrimSpace(provider.ServiceURL) != "" && !isValidAbsoluteHTTPURL(provider.ServiceURL) {
		return errors.New("service_url must be a valid http/https url")
	}
	if strings.TrimSpace(provider.ValidateURL) != "" && !isValidAbsoluteHTTPURL(provider.ValidateURL) {
		return errors.New("validate_url must be a valid http/https url")
	}
	return nil
}

func (p *CustomOAuthProvider) GetCASLoginURL() string {
	base := strings.TrimSpace(p.CASServerURL)
	if base == "" {
		return ""
	}
	parsed, err := url.Parse(base)
	if err != nil || parsed == nil || parsed.Host == "" {
		return ""
	}
	parsed.RawQuery = ""
	parsed.Fragment = ""
	trimmedPath := strings.TrimRight(parsed.Path, "/")
	if trimmedPath == "" {
		parsed.Path = "/login"
		return parsed.String()
	}
	if strings.HasSuffix(trimmedPath, "/login") {
		parsed.Path = trimmedPath
		return parsed.String()
	}
	parsed.Path = trimmedPath + "/login"
	return parsed.String()
}

func (p *CustomOAuthProvider) GetCASValidateURL() string {
	if explicit := strings.TrimSpace(p.ValidateURL); explicit != "" {
		return explicit
	}
	base := strings.TrimSpace(p.CASServerURL)
	if base == "" {
		return ""
	}
	parsed, err := url.Parse(base)
	if err != nil || parsed == nil || parsed.Host == "" {
		return ""
	}
	parsed.RawQuery = ""
	parsed.Fragment = ""
	trimmedPath := strings.TrimRight(parsed.Path, "/")
	switch {
	case trimmedPath == "":
		parsed.Path = "/serviceValidate"
	case strings.HasSuffix(trimmedPath, "/login"):
		parsed.Path = strings.TrimSuffix(trimmedPath, "/login") + "/serviceValidate"
	default:
		parsed.Path = trimmedPath + "/serviceValidate"
	}
	return parsed.String()
}

func (p *CustomOAuthProvider) GetCASServiceURL(baseCallbackURL string) string {
	if explicit := strings.TrimSpace(p.ServiceURL); explicit != "" {
		mergedURL, err := mergeCASServiceState(explicit, baseCallbackURL)
		if err == nil {
			return mergedURL
		}
		return explicit
	}
	return strings.TrimSpace(baseCallbackURL)
}

func (p *CustomOAuthProvider) ValidateCASURLs() error {
	if p.GetCASLoginURL() == "" {
		return errors.New("cas login url is invalid")
	}
	if p.GetCASValidateURL() == "" {
		return errors.New("cas validate url is invalid")
	}
	return nil
}

func (p *CustomOAuthProvider) GetCASRequiredServiceURL(baseCallbackURL string) (string, error) {
	serviceURL := p.GetCASServiceURL(baseCallbackURL)
	if !isValidAbsoluteHTTPURL(serviceURL) {
		return "", fmt.Errorf("cas service url is invalid")
	}
	return serviceURL, nil
}

func mergeCASServiceState(explicitServiceURL string, baseCallbackURL string) (string, error) {
	explicitParsed, err := url.Parse(strings.TrimSpace(explicitServiceURL))
	if err != nil || explicitParsed == nil {
		return "", fmt.Errorf("invalid explicit service url")
	}
	baseParsed, err := url.Parse(strings.TrimSpace(baseCallbackURL))
	if err != nil || baseParsed == nil {
		return explicitParsed.String(), nil
	}
	state := strings.TrimSpace(baseParsed.Query().Get("state"))
	if state == "" {
		return explicitParsed.String(), nil
	}
	query := explicitParsed.Query()
	query.Set("state", state)
	explicitParsed.RawQuery = query.Encode()
	return explicitParsed.String(), nil
}

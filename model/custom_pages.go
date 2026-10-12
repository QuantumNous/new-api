package model

import (
	"fmt"
	"net/url"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
)

const (
	CustomPagesOptionKey    = "CustomPages"
	MaxCustomPages          = 20
	MaxCustomPageNameLength = 30
	MaxCustomPageURLLength  = 500
)

type CustomPage struct {
	Name      string `json:"name"`
	URL       string `json:"url"`
	AdminOnly bool   `json:"adminOnly"`
	Highlight bool   `json:"highlight"`
}

func normalizeNavLabel(kind, name string, maxLen int) (string, error) {
	if strings.ContainsAny(name, "\r\n\t") {
		return "", fmt.Errorf("%s name cannot contain newlines or tabs", kind)
	}
	name = strings.TrimSpace(name)
	if name == "" {
		return "", fmt.Errorf("%s name is required", kind)
	}
	if utf8.RuneCountInString(name) > maxLen {
		return "", fmt.Errorf("%s name cannot exceed %d characters", kind, maxLen)
	}
	return name, nil
}

func normalizeExternalNavURL(kind, target string, maxLen int) (string, error) {
	target = strings.TrimSpace(target)
	if target == "" {
		return "", fmt.Errorf("%s URL is required", kind)
	}
	if utf8.RuneCountInString(target) > maxLen {
		return "", fmt.Errorf("%s URL cannot exceed %d characters", kind, maxLen)
	}
	parsed, err := url.Parse(target)
	if err != nil || !parsed.IsAbs() || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Hostname() == "" || strings.Contains(target, "\\") || strings.ContainsFunc(target, unicode.IsSpace) {
		return "", fmt.Errorf("%s URL must be an absolute http:// or https:// URL with a host", kind)
	}
	return target, nil
}

func ParseCustomPages(raw string) ([]CustomPage, error) {
	pages := make([]CustomPage, 0)
	if strings.TrimSpace(raw) == "" {
		return pages, nil
	}
	if err := common.UnmarshalJsonStr(raw, &pages); err != nil || pages == nil {
		return nil, fmt.Errorf("Custom pages must be a JSON array")
	}
	if len(pages) > MaxCustomPages {
		return nil, fmt.Errorf("At most 20 pages are supported")
	}
	names := make(map[string]bool, len(pages))
	for i := range pages {
		var err error
		pages[i].Name, err = normalizeNavLabel("Page", pages[i].Name, MaxCustomPageNameLength)
		if err != nil {
			return nil, err
		}
		pages[i].URL, err = normalizeExternalNavURL("Page", pages[i].URL, MaxCustomPageURLLength)
		if err != nil {
			return nil, err
		}
		name := strings.ToLower(pages[i].Name)
		if names[name] {
			return nil, fmt.Errorf("Menu names must be unique")
		}
		names[name] = true
	}
	return pages, nil
}

func ValidateCustomPagesOption(value string) error {
	_, err := ParseCustomPages(value)
	if err != nil {
		return common.NewMessage(err.Error())
	}
	return nil
}

func GetCustomPagesForRole(role int) ([]CustomPage, error) {
	common.OptionMapRWMutex.RLock()
	raw := common.OptionMap[CustomPagesOptionKey]
	common.OptionMapRWMutex.RUnlock()
	pages, err := ParseCustomPages(raw)
	if err != nil {
		return nil, err
	}
	visible := make([]CustomPage, 0, len(pages))
	for _, page := range pages {
		if page.AdminOnly && role < common.RoleAdminUser {
			continue
		}
		visible = append(visible, page)
	}
	return visible, nil
}

package setting

import (
	"encoding/json"
	"fmt"
	"net/url"
	"regexp"
	"strings"
)

const (
	CustomNavMaxItems         = 20
	CustomNavMaxContentLength = 20000
)

var customNavIDPattern = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{0,31}$`)

var (
	customNavPlacements = map[string]bool{
		"sidebar": true,
		"header":  true,
		"both":    true,
	}
	customNavSections = map[string]bool{
		"chat":     true,
		"general":  true,
		"personal": true,
		"admin":    true,
	}
	customNavContentTypes = map[string]bool{
		"html":     true,
		"markdown": true,
		"url":      true,
	}
)

// CustomNavItem is an administrator-defined navigation entry rendered in the
// sidebar and/or the header with localized labels and custom content.
type CustomNavItem struct {
	Id             string            `json:"id"`
	Labels         map[string]string `json:"labels"`
	Icon           string            `json:"icon"`
	Placement      string            `json:"placement"`
	SidebarSection string            `json:"sidebarSection"`
	ContentType    string            `json:"contentType"`
	Content        string            `json:"content"`
	Enabled        bool              `json:"enabled"`
}

// ValidateCustomNavItems checks the serialized CustomNavItems option so invalid
// administrator input is rejected before it reaches the frontend.
func ValidateCustomNavItems(raw string) error {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return nil
	}

	var items []CustomNavItem
	if err := json.Unmarshal([]byte(trimmed), &items); err != nil {
		return fmt.Errorf("自定义导航配置不是合法的 JSON 数组: %w", err)
	}

	if len(items) > CustomNavMaxItems {
		return fmt.Errorf("自定义导航项数量不能超过 %d", CustomNavMaxItems)
	}

	seen := make(map[string]bool, len(items))
	for _, item := range items {
		id := strings.TrimSpace(item.Id)
		if !customNavIDPattern.MatchString(id) {
			return fmt.Errorf("自定义导航标识无效: %s", item.Id)
		}
		if seen[id] {
			return fmt.Errorf("自定义导航标识重复: %s", id)
		}
		seen[id] = true

		if !hasNonEmptyLabel(item.Labels) {
			return fmt.Errorf("自定义导航项 %s 至少需要一个语言名称", id)
		}
		if !customNavPlacements[item.Placement] {
			return fmt.Errorf("自定义导航项 %s 的显示位置无效", id)
		}
		if !customNavSections[item.SidebarSection] {
			return fmt.Errorf("自定义导航项 %s 的侧边栏分类无效", id)
		}
		if !customNavContentTypes[item.ContentType] {
			return fmt.Errorf("自定义导航项 %s 的内容类型无效", id)
		}

		content := strings.TrimSpace(item.Content)
		if content == "" {
			return fmt.Errorf("自定义导航项 %s 的内容不能为空", id)
		}
		if len(item.Content) > CustomNavMaxContentLength {
			return fmt.Errorf("自定义导航项 %s 的内容过长", id)
		}
		if item.ContentType == "url" && !isValidCustomNavURL(content) {
			return fmt.Errorf("自定义导航项 %s 的链接必须是 http(s) 地址", id)
		}
	}

	return nil
}

func hasNonEmptyLabel(labels map[string]string) bool {
	for _, label := range labels {
		if strings.TrimSpace(label) != "" {
			return true
		}
	}
	return false
}

func isValidCustomNavURL(raw string) bool {
	parsed, err := url.Parse(raw)
	if err != nil {
		return false
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return false
	}
	return parsed.Host != ""
}

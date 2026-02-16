package console_setting

import (
	"encoding/json"
	"fmt"
	"net/url"
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/i18n"
)

var (
	urlRegex       = regexp.MustCompile(`^https?://(?:(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?|(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?))(?:\:[0-9]{1,5})?(?:/.*)?$`)
	dangerousChars = []string{"<script", "<iframe", "javascript:", "onload=", "onerror=", "onclick="}
	validColors    = map[string]bool{
		"blue": true, "green": true, "cyan": true, "purple": true, "pink": true,
		"red": true, "orange": true, "amber": true, "yellow": true, "lime": true,
		"light-green": true, "teal": true, "light-blue": true, "indigo": true,
		"violet": true, "grey": true,
	}
	slugRegex = regexp.MustCompile(`^[a-zA-Z0-9_-]+$`)
)

func parseJSONArray(jsonStr string, typeName string) ([]map[string]interface{}, error) {
	var list []map[string]interface{}
	if err := json.Unmarshal([]byte(jsonStr), &list); err != nil {
		return nil, fmt.Errorf("%s", i18n.Translate("validation.format_error", map[string]any{"Type": typeName, "Error": err.Error()}))
	}
	return list, nil
}

func validateURL(urlStr string, index int, itemType string) error {
	if !urlRegex.MatchString(urlStr) {
		return fmt.Errorf("%s", i18n.Translate("validation.url_format_invalid", map[string]any{"ItemType": itemType, "Index": index}))
	}
	if _, err := url.Parse(urlStr); err != nil {
		return fmt.Errorf("%s", i18n.Translate("validation.url_parse_failed", map[string]any{"ItemType": itemType, "Index": index, "Error": err.Error()}))
	}
	return nil
}

func checkDangerousContent(content string, index int, itemType string) error {
	lower := strings.ToLower(content)
	for _, d := range dangerousChars {
		if strings.Contains(lower, d) {
			return fmt.Errorf("%s", i18n.Translate("validation.dangerous_content", map[string]any{"ItemType": itemType, "Index": index}))
		}
	}
	return nil
}

func getJSONList(jsonStr string) []map[string]interface{} {
	if jsonStr == "" {
		return []map[string]interface{}{}
	}
	var list []map[string]interface{}
	json.Unmarshal([]byte(jsonStr), &list)
	return list
}

func ValidateConsoleSettings(settingsStr string, settingType string) error {
	if settingsStr == "" {
		return nil
	}

	switch settingType {
	case "ApiInfo":
		return validateApiInfo(settingsStr)
	case "Announcements":
		return validateAnnouncements(settingsStr)
	case "FAQ":
		return validateFAQ(settingsStr)
	case "UptimeKumaGroups":
		return validateUptimeKumaGroups(settingsStr)
	default:
		return fmt.Errorf("%s", i18n.Translate("validation.unknown_setting_type", map[string]any{"Type": settingType}))
	}
}

func validateApiInfo(apiInfoStr string) error {
	apiInfoList, err := parseJSONArray(apiInfoStr, "API info")
	if err != nil {
		return err
	}

	if len(apiInfoList) > 50 {
		return fmt.Errorf("%s", i18n.Translate("validation.api_info_max_count"))
	}

	for i, apiInfo := range apiInfoList {
		urlStr, ok := apiInfo["url"].(string)
		if !ok || urlStr == "" {
			return fmt.Errorf("%s", i18n.Translate("validation.api_info_missing_url", map[string]any{"Index": i + 1}))
		}
		route, ok := apiInfo["route"].(string)
		if !ok || route == "" {
			return fmt.Errorf("%s", i18n.Translate("validation.api_info_missing_route", map[string]any{"Index": i + 1}))
		}
		description, ok := apiInfo["description"].(string)
		if !ok || description == "" {
			return fmt.Errorf("%s", i18n.Translate("validation.api_info_missing_desc", map[string]any{"Index": i + 1}))
		}
		color, ok := apiInfo["color"].(string)
		if !ok || color == "" {
			return fmt.Errorf("%s", i18n.Translate("validation.api_info_missing_color", map[string]any{"Index": i + 1}))
		}

		if err := validateURL(urlStr, i+1, "API info"); err != nil {
			return err
		}

		if len(urlStr) > 500 {
			return fmt.Errorf("%s", i18n.Translate("validation.api_info_url_max_len", map[string]any{"Index": i + 1}))
		}
		if len(route) > 100 {
			return fmt.Errorf("%s", i18n.Translate("validation.api_info_route_max_len", map[string]any{"Index": i + 1}))
		}
		if len(description) > 200 {
			return fmt.Errorf("%s", i18n.Translate("validation.api_info_desc_max_len", map[string]any{"Index": i + 1}))
		}

		if !validColors[color] {
			return fmt.Errorf("%s", i18n.Translate("validation.api_info_invalid_color", map[string]any{"Index": i + 1}))
		}

		if err := checkDangerousContent(description, i+1, "API info"); err != nil {
			return err
		}
		if err := checkDangerousContent(route, i+1, "API info"); err != nil {
			return err
		}
	}
	return nil
}

func GetApiInfo() []map[string]interface{} {
	return getJSONList(GetConsoleSetting().ApiInfo)
}

func validateAnnouncements(announcementsStr string) error {
	list, err := parseJSONArray(announcementsStr, "announcements")
	if err != nil {
		return err
	}
	if len(list) > 100 {
		return fmt.Errorf("%s", i18n.Translate("validation.announcement_max_count"))
	}
	validTypes := map[string]bool{
		"default": true, "ongoing": true, "success": true, "warning": true, "error": true,
	}
	for i, ann := range list {
		content, ok := ann["content"].(string)
		if !ok || content == "" {
			return fmt.Errorf("%s", i18n.Translate("validation.announcement_no_content", map[string]any{"Index": i + 1}))
		}
		publishDateAny, exists := ann["publishDate"]
		if !exists {
			return fmt.Errorf("%s", i18n.Translate("validation.announcement_no_date", map[string]any{"Index": i + 1}))
		}
		publishDateStr, ok := publishDateAny.(string)
		if !ok || publishDateStr == "" {
			return fmt.Errorf("%s", i18n.Translate("validation.announcement_date_empty", map[string]any{"Index": i + 1}))
		}
		if _, err := time.Parse(time.RFC3339, publishDateStr); err != nil {
			return fmt.Errorf("%s", i18n.Translate("validation.announcement_date_format", map[string]any{"Index": i + 1}))
		}
		if t, exists := ann["type"]; exists {
			if typeStr, ok := t.(string); ok {
				if !validTypes[typeStr] {
					return fmt.Errorf("%s", i18n.Translate("validation.announcement_invalid_type", map[string]any{"Index": i + 1}))
				}
			}
		}
		if len(content) > 500 {
			return fmt.Errorf("%s", i18n.Translate("validation.announcement_content_max", map[string]any{"Index": i + 1}))
		}
		if extra, exists := ann["extra"]; exists {
			if extraStr, ok := extra.(string); ok && len(extraStr) > 200 {
				return fmt.Errorf("%s", i18n.Translate("validation.announcement_desc_max", map[string]any{"Index": i + 1}))
			}
		}
	}
	return nil
}

func validateFAQ(faqStr string) error {
	list, err := parseJSONArray(faqStr, "FAQ")
	if err != nil {
		return err
	}
	if len(list) > 100 {
		return fmt.Errorf("%s", i18n.Translate("validation.faq_max_count"))
	}
	for i, faq := range list {
		question, ok := faq["question"].(string)
		if !ok || question == "" {
			return fmt.Errorf("%s", i18n.Translate("validation.faq_no_question", map[string]any{"Index": i + 1}))
		}
		answer, ok := faq["answer"].(string)
		if !ok || answer == "" {
			return fmt.Errorf("%s", i18n.Translate("validation.faq_no_answer", map[string]any{"Index": i + 1}))
		}
		if len(question) > 200 {
			return fmt.Errorf("%s", i18n.Translate("validation.faq_question_max_len", map[string]any{"Index": i + 1}))
		}
		if len(answer) > 1000 {
			return fmt.Errorf("%s", i18n.Translate("validation.faq_answer_max_len", map[string]any{"Index": i + 1}))
		}
	}
	return nil
}

func getPublishTime(item map[string]interface{}) time.Time {
	if v, ok := item["publishDate"]; ok {
		if s, ok2 := v.(string); ok2 {
			if t, err := time.Parse(time.RFC3339, s); err == nil {
				return t
			}
		}
	}
	return time.Time{}
}

func GetAnnouncements() []map[string]interface{} {
	list := getJSONList(GetConsoleSetting().Announcements)
	sort.SliceStable(list, func(i, j int) bool {
		return getPublishTime(list[i]).After(getPublishTime(list[j]))
	})
	return list
}

func GetFAQ() []map[string]interface{} {
	return getJSONList(GetConsoleSetting().FAQ)
}

func validateUptimeKumaGroups(groupsStr string) error {
	groups, err := parseJSONArray(groupsStr, "Uptime Kuma group config")
	if err != nil {
		return err
	}

	if len(groups) > 20 {
		return fmt.Errorf("%s", i18n.Translate("validation.uptime_group_max_count"))
	}

	nameSet := make(map[string]bool)

	for i, group := range groups {
		categoryName, ok := group["categoryName"].(string)
		if !ok || categoryName == "" {
			return fmt.Errorf("%s", i18n.Translate("validation.uptime_group_no_category", map[string]any{"Index": i + 1}))
		}
		if nameSet[categoryName] {
			return fmt.Errorf("%s", i18n.Translate("validation.uptime_group_dup_category", map[string]any{"Index": i + 1}))
		}
		nameSet[categoryName] = true
		urlStr, ok := group["url"].(string)
		if !ok || urlStr == "" {
			return fmt.Errorf("%s", i18n.Translate("validation.uptime_group_no_url", map[string]any{"Index": i + 1}))
		}
		slug, ok := group["slug"].(string)
		if !ok || slug == "" {
			return fmt.Errorf("%s", i18n.Translate("validation.uptime_group_no_slug", map[string]any{"Index": i + 1}))
		}
		description, ok := group["description"].(string)
		if !ok {
			description = ""
		}

		if err := validateURL(urlStr, i+1, "group"); err != nil {
			return err
		}

		if len(categoryName) > 50 {
			return fmt.Errorf("%s", i18n.Translate("validation.uptime_group_category_max", map[string]any{"Index": i + 1}))
		}
		if len(urlStr) > 500 {
			return fmt.Errorf("%s", i18n.Translate("validation.uptime_group_url_max", map[string]any{"Index": i + 1}))
		}
		if len(slug) > 100 {
			return fmt.Errorf("%s", i18n.Translate("validation.uptime_group_slug_max", map[string]any{"Index": i + 1}))
		}
		if len(description) > 200 {
			return fmt.Errorf("%s", i18n.Translate("validation.uptime_group_desc_max", map[string]any{"Index": i + 1}))
		}

		if !slugRegex.MatchString(slug) {
			return fmt.Errorf("%s", i18n.Translate("validation.uptime_group_slug_format", map[string]any{"Index": i + 1}))
		}

		if err := checkDangerousContent(description, i+1, "group"); err != nil {
			return err
		}
		if err := checkDangerousContent(categoryName, i+1, "group"); err != nil {
			return err
		}
	}
	return nil
}

func GetUptimeKumaGroups() []map[string]interface{} {
	return getJSONList(GetConsoleSetting().UptimeKumaGroups)
}

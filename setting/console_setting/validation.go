package console_setting

import (
	"encoding/json"
	"fmt"
	"net/url"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
)

var (
	urlRegex       = regexp.MustCompile(`^https?://(?:(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?|(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?))(?:\:[0-9]{1,5})?(?:/.*)?$`)
	dangerousChars = []string{"<script", "<iframe", "javascript:", "onload=", "onerror=", "onclick="}
	validColors    = map[string]bool{
		"blue": true, "green": true, "cyan": true, "purple": true, "pink": true,
		"red": true, "orange": true, "amber": true, "yellow": true, "lime": true,
		"light-green": true, "teal": true, "light-blue": true, "indigo": true,
		"violet": true, "grey": true, "slate": true,
	}
	slugRegex = regexp.MustCompile(`^[a-zA-Z0-9_-]+$`)
)

func parseJSONArray(jsonStr string, typeName string) ([]map[string]interface{}, error) {
	var list []map[string]interface{}
	if err := json.Unmarshal([]byte(jsonStr), &list); err != nil {
		return nil, fmt.Errorf("%s格式错误：%s", typeName, err.Error())
	}
	return list, nil
}

func validateURL(urlStr string, index int, itemType string) error {
	if !urlRegex.MatchString(urlStr) {
		return fmt.Errorf("第%d个%s的URL格式不正确", index, itemType)
	}
	if _, err := url.Parse(urlStr); err != nil {
		return fmt.Errorf("第%d个%s的URL无法解析：%s", index, itemType, err.Error())
	}
	return nil
}

func checkDangerousContent(content string, index int, itemType string) error {
	lower := strings.ToLower(content)
	for _, d := range dangerousChars {
		if strings.Contains(lower, d) {
			return fmt.Errorf("第%d个%s包含不允许的内容", index, itemType)
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
	case "CustomPages":
		return validateCustomPages(settingsStr)
	default:
		return fmt.Errorf("未知的设置类型：%s", settingType)
	}
}

var validCustomPageIcons = map[string]bool{
	"Link": true, "BookOpen": true, "ExternalLink": true, "FileText": true,
	"Globe": true, "Layout": true, "Newspaper": true, "HelpCircle": true,
	"Bookmark": true, "FolderOpen": true,
}

var validCustomPageOpenModes = map[string]bool{
	"embed":    true,
	"external": true,
}

var validExtensionVisibilities = map[string]bool{
	"all":   true,
	"admin": true,
}

func NormalizeExtensionVisibility(visibility string) string {
	visibility = strings.TrimSpace(visibility)
	if validExtensionVisibilities[visibility] {
		return visibility
	}
	return "all"
}

func IsAvailabilityMonitorVisible(isAdmin bool) bool {
	cs := GetConsoleSetting()
	if !cs.AvailabilityMonitorEnabled {
		return false
	}
	visibility := NormalizeExtensionVisibility(cs.AvailabilityMonitorVisibility)
	if visibility == "admin" {
		return isAdmin
	}
	return true
}

func ValidateAvailabilityMonitorVisibility(value string) error {
	if !validExtensionVisibilities[strings.TrimSpace(value)] {
		return fmt.Errorf("可用性监控可见范围不合法，仅支持 all 或 admin")
	}
	return nil
}

const (
	availabilityMonitorRefreshIntervalMin = 5
	availabilityMonitorRefreshIntervalMax = 3600
)

func ValidateAvailabilityMonitorRefreshInterval(value string) error {
	seconds, err := strconv.Atoi(strings.TrimSpace(value))
	if err != nil {
		return fmt.Errorf("可用性监控刷新间隔必须是整数秒")
	}
	if seconds < availabilityMonitorRefreshIntervalMin || seconds > availabilityMonitorRefreshIntervalMax {
		return fmt.Errorf(
			"可用性监控刷新间隔须在 %d–%d 秒之间",
			availabilityMonitorRefreshIntervalMin,
			availabilityMonitorRefreshIntervalMax,
		)
	}
	return nil
}

// GetAvailabilityMonitorRefreshInterval returns the configured auto-refresh
// interval in seconds, clamped to the allowed range.
func GetAvailabilityMonitorRefreshInterval() int {
	seconds := GetConsoleSetting().AvailabilityMonitorRefreshInterval
	if seconds < availabilityMonitorRefreshIntervalMin {
		return availabilityMonitorRefreshIntervalMin
	}
	if seconds > availabilityMonitorRefreshIntervalMax {
		return availabilityMonitorRefreshIntervalMax
	}
	return seconds
}

func getJSONString(item map[string]interface{}, key string) (string, bool) {
	v, ok := item[key].(string)
	return v, ok
}

func getJSONBool(item map[string]interface{}, key string) (bool, bool) {
	v, ok := item[key].(bool)
	return v, ok
}

func getJSONSort(item map[string]interface{}) int {
	v, exists := item["sort"]
	if !exists || v == nil {
		return 0
	}
	switch n := v.(type) {
	case float64:
		return int(n)
	case int:
		return n
	case int64:
		return int(n)
	case json.Number:
		i, err := n.Int64()
		if err != nil {
			return 0
		}
		return int(i)
	default:
		return 0
	}
}

func validateCustomPages(customPagesStr string) error {
	list, err := parseJSONArray(customPagesStr, "定制页面")
	if err != nil {
		return err
	}

	idSet := make(map[string]bool)
	for i, page := range list {
		id, ok := getJSONString(page, "id")
		if !ok || strings.TrimSpace(id) == "" {
			return fmt.Errorf("第%d个定制页面缺少id字段", i+1)
		}
		id = strings.TrimSpace(id)
		if len(id) > 64 {
			return fmt.Errorf("第%d个定制页面的id长度不能超过64字符", i+1)
		}
		if !slugRegex.MatchString(id) {
			return fmt.Errorf("第%d个定制页面的id只能包含字母、数字、下划线和连字符", i+1)
		}
		if idSet[id] {
			return fmt.Errorf("第%d个定制页面的id与其他项重复", i+1)
		}
		idSet[id] = true

		title, ok := getJSONString(page, "title")
		if !ok || strings.TrimSpace(title) == "" {
			return fmt.Errorf("第%d个定制页面缺少标题字段", i+1)
		}
		title = strings.TrimSpace(title)
		if len(title) > 100 {
			return fmt.Errorf("第%d个定制页面的标题长度不能超过100字符", i+1)
		}
		if err := checkDangerousContent(title, i+1, "定制页面"); err != nil {
			return err
		}

		urlStr, ok := getJSONString(page, "url")
		if !ok {
			urlStr = ""
		}
		urlStr = strings.TrimSpace(urlStr)
		if urlStr != "" {
			if err := validateURL(urlStr, i+1, "定制页面"); err != nil {
				return err
			}
			if len(urlStr) > 500 {
				return fmt.Errorf("第%d个定制页面的URL长度不能超过500字符", i+1)
			}
		}

		icon, ok := getJSONString(page, "icon")
		if ok && strings.TrimSpace(icon) != "" {
			icon = strings.TrimSpace(icon)
			if !validCustomPageIcons[icon] {
				return fmt.Errorf("第%d个定制页面的图标不在预设列表中", i+1)
			}
		}

		if _, exists := page["enabled"]; exists {
			if _, ok := getJSONBool(page, "enabled"); !ok {
				return fmt.Errorf("第%d个定制页面的enabled字段必须是布尔值", i+1)
			}
		}

		if openMode, exists := page["open_mode"]; exists && openMode != nil {
			openModeStr, ok := openMode.(string)
			if !ok || !validCustomPageOpenModes[strings.TrimSpace(openModeStr)] {
				return fmt.Errorf("第%d个定制页面的打开方式不合法，仅支持 embed 或 external", i+1)
			}
		}

		if visibility, exists := page["visibility"]; exists && visibility != nil {
			visibilityStr, ok := visibility.(string)
			if !ok || !validExtensionVisibilities[strings.TrimSpace(visibilityStr)] {
				return fmt.Errorf("第%d个定制页面的可见范围不合法，仅支持 all 或 admin", i+1)
			}
		}

		if _, exists := page["sort"]; exists && page["sort"] != nil {
			switch page["sort"].(type) {
			case float64, int, int64, json.Number:
			default:
				return fmt.Errorf("第%d个定制页面的sort字段必须是数字", i+1)
			}
		}
	}
	return nil
}

// GetCustomPages returns enabled custom pages visible to admins (all visibilities).
func GetCustomPages() []map[string]interface{} {
	return GetCustomPagesForRole(true)
}

// GetCustomPagesForRole returns enabled custom pages with non-empty URLs for the given role.
func GetCustomPagesForRole(isAdmin bool) []map[string]interface{} {
	list := getJSONList(GetConsoleSetting().CustomPages)
	result := make([]map[string]interface{}, 0, len(list))
	for _, page := range list {
		enabled, hasEnabled := getJSONBool(page, "enabled")
		if hasEnabled && !enabled {
			continue
		}
		if !hasEnabled {
			continue
		}
		urlStr, _ := getJSONString(page, "url")
		urlStr = strings.TrimSpace(urlStr)
		if urlStr == "" {
			continue
		}
		visibility, _ := getJSONString(page, "visibility")
		visibility = NormalizeExtensionVisibility(visibility)
		if visibility == "admin" && !isAdmin {
			continue
		}
		id, _ := getJSONString(page, "id")
		title, _ := getJSONString(page, "title")
		icon, _ := getJSONString(page, "icon")
		icon = strings.TrimSpace(icon)
		if icon == "" || !validCustomPageIcons[icon] {
			icon = "Link"
		}
		openMode, _ := getJSONString(page, "open_mode")
		openMode = strings.TrimSpace(openMode)
		if !validCustomPageOpenModes[openMode] {
			openMode = "embed"
		}
		result = append(result, map[string]interface{}{
			"id":        strings.TrimSpace(id),
			"title":     strings.TrimSpace(title),
			"icon":      icon,
			"url":       urlStr,
			"open_mode": openMode,
			"sort":      getJSONSort(page),
		})
	}
	sort.SliceStable(result, func(i, j int) bool {
		si := getJSONSort(result[i])
		sj := getJSONSort(result[j])
		if si != sj {
			return si < sj
		}
		idi, _ := result[i]["id"].(string)
		idj, _ := result[j]["id"].(string)
		return idi < idj
	})
	// Strip sort from public payload
	for _, page := range result {
		delete(page, "sort")
	}
	return result
}

func validateApiInfo(apiInfoStr string) error {
	apiInfoList, err := parseJSONArray(apiInfoStr, "API信息")
	if err != nil {
		return err
	}

	if len(apiInfoList) > 50 {
		return fmt.Errorf("API信息数量不能超过50个")
	}

	for i, apiInfo := range apiInfoList {
		urlStr, ok := apiInfo["url"].(string)
		if !ok || urlStr == "" {
			return fmt.Errorf("第%d个API信息缺少URL字段", i+1)
		}
		route, ok := apiInfo["route"].(string)
		if !ok || route == "" {
			return fmt.Errorf("第%d个API信息缺少线路描述字段", i+1)
		}
		description, ok := apiInfo["description"].(string)
		if !ok || description == "" {
			return fmt.Errorf("第%d个API信息缺少说明字段", i+1)
		}
		color, ok := apiInfo["color"].(string)
		if !ok || color == "" {
			return fmt.Errorf("第%d个API信息缺少颜色字段", i+1)
		}

		if err := validateURL(urlStr, i+1, "API信息"); err != nil {
			return err
		}

		if len(urlStr) > 500 {
			return fmt.Errorf("第%d个API信息的URL长度不能超过500字符", i+1)
		}
		if len(route) > 100 {
			return fmt.Errorf("第%d个API信息的线路描述长度不能超过100字符", i+1)
		}
		if len(description) > 200 {
			return fmt.Errorf("第%d个API信息的说明长度不能超过200字符", i+1)
		}

		if !validColors[color] {
			return fmt.Errorf("第%d个API信息的颜色值不合法", i+1)
		}

		if err := checkDangerousContent(description, i+1, "API信息"); err != nil {
			return err
		}
		if err := checkDangerousContent(route, i+1, "API信息"); err != nil {
			return err
		}
	}
	return nil
}

func GetApiInfo() []map[string]interface{} {
	return getJSONList(GetConsoleSetting().ApiInfo)
}

func validateAnnouncements(announcementsStr string) error {
	list, err := parseJSONArray(announcementsStr, "系统公告")
	if err != nil {
		return err
	}
	if len(list) > 100 {
		return fmt.Errorf("系统公告数量不能超过100个")
	}
	validTypes := map[string]bool{
		"default": true, "ongoing": true, "success": true, "warning": true, "error": true,
	}
	for i, ann := range list {
		content, ok := ann["content"].(string)
		if !ok || content == "" {
			return fmt.Errorf("第%d个公告缺少内容字段", i+1)
		}
		publishDateAny, exists := ann["publishDate"]
		if !exists {
			return fmt.Errorf("第%d个公告缺少发布日期字段", i+1)
		}
		publishDateStr, ok := publishDateAny.(string)
		if !ok || publishDateStr == "" {
			return fmt.Errorf("第%d个公告的发布日期不能为空", i+1)
		}
		if _, err := time.Parse(time.RFC3339, publishDateStr); err != nil {
			return fmt.Errorf("第%d个公告的发布日期格式错误", i+1)
		}
		if t, exists := ann["type"]; exists {
			if typeStr, ok := t.(string); ok {
				if !validTypes[typeStr] {
					return fmt.Errorf("第%d个公告的类型值不合法", i+1)
				}
			}
		}
		if len(content) > 500 {
			return fmt.Errorf("第%d个公告的内容长度不能超过500字符", i+1)
		}
		if extra, exists := ann["extra"]; exists {
			if extraStr, ok := extra.(string); ok && len(extraStr) > 200 {
				return fmt.Errorf("第%d个公告的说明长度不能超过200字符", i+1)
			}
		}
	}
	return nil
}

func validateFAQ(faqStr string) error {
	list, err := parseJSONArray(faqStr, "FAQ信息")
	if err != nil {
		return err
	}
	if len(list) > 100 {
		return fmt.Errorf("FAQ数量不能超过100个")
	}
	for i, faq := range list {
		question, ok := faq["question"].(string)
		if !ok || question == "" {
			return fmt.Errorf("第%d个FAQ缺少问题字段", i+1)
		}
		answer, ok := faq["answer"].(string)
		if !ok || answer == "" {
			return fmt.Errorf("第%d个FAQ缺少答案字段", i+1)
		}
		if len(question) > 200 {
			return fmt.Errorf("第%d个FAQ的问题长度不能超过200字符", i+1)
		}
		if len(answer) > 1000 {
			return fmt.Errorf("第%d个FAQ的答案长度不能超过1000字符", i+1)
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
	groups, err := parseJSONArray(groupsStr, "Uptime Kuma分组配置")
	if err != nil {
		return err
	}

	if len(groups) > 20 {
		return fmt.Errorf("Uptime Kuma分组数量不能超过20个")
	}

	nameSet := make(map[string]bool)

	for i, group := range groups {
		categoryName, ok := group["categoryName"].(string)
		if !ok || categoryName == "" {
			return fmt.Errorf("第%d个分组缺少分类名称字段", i+1)
		}
		if nameSet[categoryName] {
			return fmt.Errorf("第%d个分组的分类名称与其他分组重复", i+1)
		}
		nameSet[categoryName] = true
		urlStr, ok := group["url"].(string)
		if !ok || urlStr == "" {
			return fmt.Errorf("第%d个分组缺少URL字段", i+1)
		}
		slug, ok := group["slug"].(string)
		if !ok || slug == "" {
			return fmt.Errorf("第%d个分组缺少Slug字段", i+1)
		}
		description, ok := group["description"].(string)
		if !ok {
			description = ""
		}

		if err := validateURL(urlStr, i+1, "分组"); err != nil {
			return err
		}

		if len(categoryName) > 50 {
			return fmt.Errorf("第%d个分组的分类名称长度不能超过50字符", i+1)
		}
		if len(urlStr) > 500 {
			return fmt.Errorf("第%d个分组的URL长度不能超过500字符", i+1)
		}
		if len(slug) > 100 {
			return fmt.Errorf("第%d个分组的Slug长度不能超过100字符", i+1)
		}
		if len(description) > 200 {
			return fmt.Errorf("第%d个分组的描述长度不能超过200字符", i+1)
		}

		if !slugRegex.MatchString(slug) {
			return fmt.Errorf("第%d个分组的Slug只能包含字母、数字、下划线和连字符", i+1)
		}

		if err := checkDangerousContent(description, i+1, "分组"); err != nil {
			return err
		}
		if err := checkDangerousContent(categoryName, i+1, "分组"); err != nil {
			return err
		}
	}
	return nil
}

func GetUptimeKumaGroups() []map[string]interface{} {
	return getJSONList(GetConsoleSetting().UptimeKumaGroups)
}

package console_setting

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"net/url"
	"regexp"
	"sort"
	"strings"
	"time"
	"unicode/utf16"

	"github.com/QuantumNous/new-api/common"
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
	validSupportIcons = map[string]bool{
		"message": true, "instagram": true, "send": true, "twitter": true,
		"github": true, "globe": true, "book": true, "mail": true, "help": true,
	}
	validSupportIconDataPrefixes = map[string]string{
		"data:image/png;base64,":  "png",
		"data:image/jpeg;base64,": "jpeg",
		"data:image/webp;base64,": "webp",
		"data:image/gif;base64,":  "gif",
	}
	validFooterSocialIcons = map[string]bool{
		"github": true, "documentation": true, "discord": true,
		"telegram": true, "email": true,
	}
	supportLobeIconRegex = regexp.MustCompile(`^[A-Z][A-Za-z0-9]*(?:\.[A-Z][A-Za-z0-9]*)?$`)
	slugRegex            = regexp.MustCompile(`^[a-zA-Z0-9_-]+$`)
)

const supportIconMaxFileSize = 100 * 1024

type FooterLink struct {
	ID    string `json:"id"`
	Label string `json:"label"`
	URL   string `json:"url"`
}

type FooterSocialLink struct {
	ID    string `json:"id"`
	Label string `json:"label"`
	URL   string `json:"url"`
	Icon  string `json:"icon"`
}

type FooterColumn struct {
	ID    string       `json:"id"`
	Title string       `json:"title"`
	Links []FooterLink `json:"links"`
}

type FooterConfig struct {
	Registrations []FooterSocialLink `json:"registrations,omitempty"`
	Description   string             `json:"description"`
	SocialLinks   []FooterSocialLink `json:"socialLinks"`
	Columns       []FooterColumn     `json:"columns"`
}

type WalletPromotionConfig struct {
	Enabled     bool   `json:"enabled"`
	Title       string `json:"title"`
	Description string `json:"description"`
	ActionLabel string `json:"actionLabel"`
	ActionURL   string `json:"actionUrl"`
	ImageURL    string `json:"imageUrl"`
}

func parseJSONArray(jsonStr string, typeName string) ([]map[string]interface{}, error) {
	var list []map[string]interface{}
	if err := common.UnmarshalJsonStr(jsonStr, &list); err != nil {
		return nil, fmt.Errorf("%s格式错误：%s", typeName, err.Error())
	}
	return list, nil
}

func exceedsMaxCharacters(s string, max int) bool {
	return len(utf16.Encode([]rune(s))) > max
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

func validateUploadedSupportIcon(icon string) bool {
	separator := strings.IndexByte(icon, ',')
	if separator < 0 {
		return false
	}

	imageType, ok := validSupportIconDataPrefixes[icon[:separator+1]]
	if !ok {
		return false
	}

	encoded := icon[separator+1:]
	if encoded == "" || len(encoded) > base64.StdEncoding.EncodedLen(supportIconMaxFileSize) {
		return false
	}
	decoded, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil || len(decoded) == 0 || len(decoded) > supportIconMaxFileSize {
		return false
	}

	switch imageType {
	case "png":
		return bytes.HasPrefix(decoded, []byte{0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a})
	case "jpeg":
		return bytes.HasPrefix(decoded, []byte{0xff, 0xd8, 0xff})
	case "gif":
		return bytes.HasPrefix(decoded, []byte("GIF87a")) || bytes.HasPrefix(decoded, []byte("GIF89a"))
	case "webp":
		return len(decoded) >= 12 && bytes.Equal(decoded[:4], []byte("RIFF")) && bytes.Equal(decoded[8:12], []byte("WEBP"))
	default:
		return false
	}
}

func validateFooterLinkURL(value string) bool {
	if value == "" || value != strings.TrimSpace(value) || exceedsMaxCharacters(value, 500) {
		return false
	}
	if strings.ContainsAny(value, "\r\n\\") {
		return false
	}
	if strings.HasPrefix(value, "/") {
		return !strings.HasPrefix(value, "//")
	}

	parsed, err := url.Parse(value)
	if err != nil {
		return false
	}
	switch strings.ToLower(parsed.Scheme) {
	case "http", "https":
		return parsed.Host != ""
	case "mailto":
		return parsed.Opaque != "" || parsed.Path != ""
	default:
		return false
	}
}

func validateWalletPromotionActionURL(value string) bool {
	if value == "" || value != strings.TrimSpace(value) || exceedsMaxCharacters(value, 500) {
		return false
	}
	if strings.ContainsAny(value, "\r\n\\") {
		return false
	}
	if strings.HasPrefix(value, "/") {
		return !strings.HasPrefix(value, "//")
	}

	parsed, err := url.Parse(value)
	if err != nil {
		return false
	}
	return (strings.EqualFold(parsed.Scheme, "http") || strings.EqualFold(parsed.Scheme, "https")) && parsed.Host != ""
}

func validateWalletPromotionImageURL(value string) bool {
	if value == "" || value != strings.TrimSpace(value) || exceedsMaxCharacters(value, 500) {
		return false
	}
	if strings.ContainsAny(value, "\r\n\\") {
		return false
	}

	parsed, err := url.Parse(value)
	if err != nil {
		return false
	}
	return (strings.EqualFold(parsed.Scheme, "http") || strings.EqualFold(parsed.Scheme, "https")) && parsed.Host != ""
}

func validateFooterLink(id string, label string, href string, location string) error {
	if id == "" || !slugRegex.MatchString(id) || exceedsMaxCharacters(id, 64) {
		return fmt.Errorf("%s的ID格式不正确", location)
	}
	if strings.TrimSpace(label) == "" || exceedsMaxCharacters(label, 80) {
		return fmt.Errorf("%s的标题为空或超过80字符", location)
	}
	if !validateFooterLinkURL(href) {
		return fmt.Errorf("%s的链接地址不合法", location)
	}
	return nil
}

func parseFooterConfig(settingsStr string) (FooterConfig, error) {
	var footer FooterConfig
	if err := common.UnmarshalJsonStr(settingsStr, &footer); err != nil {
		return FooterConfig{}, fmt.Errorf("主页页脚配置格式错误：%s", err.Error())
	}
	return footer, nil
}

func validateFooterConfig(settingsStr string) error {
	footer, err := parseFooterConfig(settingsStr)
	if err != nil {
		return err
	}
	if exceedsMaxCharacters(footer.Description, 240) {
		return fmt.Errorf("主页页脚说明不能超过240字符")
	}
	if footer.SocialLinks == nil || footer.Columns == nil {
		return fmt.Errorf("主页页脚配置缺少社交链接或分栏列表")
	}
	if len(footer.SocialLinks) > 8 {
		return fmt.Errorf("主页页脚社交链接不能超过8个")
	}
	if len(footer.Columns) > 6 {
		return fmt.Errorf("主页页脚分栏不能超过6个")
	}

	if len(footer.Registrations) > 10 {
		return fmt.Errorf("备案信息不能超过10条")
	}
	registrationIDs := make(map[string]bool)
	for index, record := range footer.Registrations {
		location := fmt.Sprintf("第%d条备案信息", index+1)
		if err := validateFooterLink(record.ID, record.Label, record.URL, location); err != nil {
			return err
		}
		parsed, err := url.Parse(record.URL)
		if err != nil || parsed.User != nil || !(parsed.Scheme == "https" || parsed.Scheme == "http") || parsed.Host == "" {
			return fmt.Errorf("%s必须使用HTTP或HTTPS链接", location)
		}
		if registrationIDs[record.ID] {
			return fmt.Errorf("%s的ID重复", location)
		}
		registrationIDs[record.ID] = true
		if record.Icon != "" && !validateUploadedSupportIcon(record.Icon) {
			return fmt.Errorf("%s的图标无效或超过100KB", location)
		}
	}

	socialIDs := make(map[string]bool)
	for index, link := range footer.SocialLinks {
		location := fmt.Sprintf("第%d个主页页脚社交链接", index+1)
		if err := validateFooterLink(link.ID, link.Label, link.URL, location); err != nil {
			return err
		}
		if socialIDs[link.ID] {
			return fmt.Errorf("%s的ID重复", location)
		}
		socialIDs[link.ID] = true
		if !validFooterSocialIcons[link.Icon] {
			return fmt.Errorf("%s的图标不合法", location)
		}
	}

	columnIDs := make(map[string]bool)
	linkIDs := make(map[string]bool)
	for columnIndex, column := range footer.Columns {
		columnLocation := fmt.Sprintf("第%d个主页页脚分栏", columnIndex+1)
		if column.ID == "" || !slugRegex.MatchString(column.ID) || exceedsMaxCharacters(column.ID, 64) {
			return fmt.Errorf("%s的ID格式不正确", columnLocation)
		}
		if columnIDs[column.ID] {
			return fmt.Errorf("%s的ID重复", columnLocation)
		}
		columnIDs[column.ID] = true
		if strings.TrimSpace(column.Title) == "" || exceedsMaxCharacters(column.Title, 80) {
			return fmt.Errorf("%s的标题为空或超过80字符", columnLocation)
		}
		if len(column.Links) > 10 {
			return fmt.Errorf("%s的链接不能超过10个", columnLocation)
		}
		for linkIndex, link := range column.Links {
			location := fmt.Sprintf("%s的第%d个链接", columnLocation, linkIndex+1)
			if err := validateFooterLink(link.ID, link.Label, link.URL, location); err != nil {
				return err
			}
			if linkIDs[link.ID] {
				return fmt.Errorf("%s的ID重复", location)
			}
			linkIDs[link.ID] = true
		}
	}
	return nil
}

func parseWalletPromotionConfig(settingsStr string) (WalletPromotionConfig, error) {
	var promotion WalletPromotionConfig
	if err := common.UnmarshalJsonStr(settingsStr, &promotion); err != nil {
		return WalletPromotionConfig{}, fmt.Errorf("钱包页推广配置格式错误：%s", err.Error())
	}
	return promotion, nil
}

func validateWalletPromotionConfig(settingsStr string) error {
	promotion, err := parseWalletPromotionConfig(settingsStr)
	if err != nil {
		return err
	}
	if exceedsMaxCharacters(promotion.Title, 80) {
		return fmt.Errorf("钱包页推广标题不能超过80字符")
	}
	if exceedsMaxCharacters(promotion.Description, 240) {
		return fmt.Errorf("钱包页推广说明不能超过240字符")
	}
	if promotion.Enabled && strings.TrimSpace(promotion.Title) == "" {
		return fmt.Errorf("启用钱包页推广时必须填写标题")
	}

	hasActionLabel := promotion.ActionLabel != ""
	hasActionURL := promotion.ActionURL != ""
	if hasActionLabel != hasActionURL {
		return fmt.Errorf("钱包页推广的操作文案和链接地址必须同时填写")
	}
	if hasActionLabel {
		if strings.TrimSpace(promotion.ActionLabel) == "" || exceedsMaxCharacters(promotion.ActionLabel, 40) {
			return fmt.Errorf("钱包页推广的操作文案为空或超过40字符")
		}
		if !validateWalletPromotionActionURL(promotion.ActionURL) {
			return fmt.Errorf("钱包页推广的链接地址不合法")
		}
	}
	if promotion.ImageURL != "" && !validateWalletPromotionImageURL(promotion.ImageURL) {
		return fmt.Errorf("钱包页推广的图片地址不合法")
	}
	return nil
}

func getJSONList(jsonStr string) []map[string]interface{} {
	if jsonStr == "" {
		return []map[string]interface{}{}
	}
	var list []map[string]interface{}
	_ = common.UnmarshalJsonStr(jsonStr, &list)
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
	case "SupportLinks":
		return validateSupportLinks(settingsStr)
	case "Footer":
		return validateFooterConfig(settingsStr)
	case "WalletPromotion":
		return validateWalletPromotionConfig(settingsStr)
	default:
		return fmt.Errorf("未知的设置类型：%s", settingType)
	}
}

func validateSupportLinks(settingsStr string) error {
	categories, err := parseJSONArray(settingsStr, "支持页面配置")
	if err != nil {
		return err
	}
	if len(categories) > 20 {
		return fmt.Errorf("支持页面分类数量不能超过20个")
	}

	categoryIDs := make(map[string]bool)
	itemIDs := make(map[string]bool)
	for categoryIndex, category := range categories {
		id, ok := category["id"].(string)
		if !ok || id == "" || !slugRegex.MatchString(id) {
			return fmt.Errorf("第%d个支持分类的ID格式不正确", categoryIndex+1)
		}
		if categoryIDs[id] {
			return fmt.Errorf("第%d个支持分类的ID重复", categoryIndex+1)
		}
		categoryIDs[id] = true

		title, ok := category["title"].(string)
		if !ok || strings.TrimSpace(title) == "" {
			return fmt.Errorf("第%d个支持分类缺少标题字段", categoryIndex+1)
		}
		if exceedsMaxCharacters(title, 80) {
			return fmt.Errorf("第%d个支持分类的标题长度不能超过80字符", categoryIndex+1)
		}
		if description, exists := category["description"]; exists {
			descriptionString, ok := description.(string)
			if !ok || exceedsMaxCharacters(descriptionString, 240) {
				return fmt.Errorf("第%d个支持分类的说明格式不正确或超过240字符", categoryIndex+1)
			}
		}

		items, ok := category["items"].([]interface{})
		if !ok {
			return fmt.Errorf("第%d个支持分类缺少入口列表", categoryIndex+1)
		}
		if len(items) > 30 {
			return fmt.Errorf("第%d个支持分类的入口数量不能超过30个", categoryIndex+1)
		}
		for itemIndex, rawItem := range items {
			item, ok := rawItem.(map[string]interface{})
			if !ok {
				return fmt.Errorf("第%d个支持分类的第%d个入口格式不正确", categoryIndex+1, itemIndex+1)
			}
			itemID, ok := item["id"].(string)
			if !ok || itemID == "" || !slugRegex.MatchString(itemID) {
				return fmt.Errorf("第%d个支持分类的第%d个入口ID格式不正确", categoryIndex+1, itemIndex+1)
			}
			if itemIDs[itemID] {
				return fmt.Errorf("第%d个支持分类的第%d个入口ID重复", categoryIndex+1, itemIndex+1)
			}
			itemIDs[itemID] = true

			itemTitle, ok := item["title"].(string)
			if !ok || strings.TrimSpace(itemTitle) == "" || exceedsMaxCharacters(itemTitle, 80) {
				return fmt.Errorf("第%d个支持分类的第%d个入口标题为空或超过80字符", categoryIndex+1, itemIndex+1)
			}
			urlString, ok := item["url"].(string)
			if !ok || exceedsMaxCharacters(urlString, 500) {
				return fmt.Errorf("第%d个支持分类的第%d个入口URL为空或超过500字符", categoryIndex+1, itemIndex+1)
			}
			if err := validateURL(urlString, itemIndex+1, "支持入口"); err != nil {
				return err
			}
			icon, ok := item["icon"].(string)
			validLobeIcon := ok && !exceedsMaxCharacters(icon, 80) && supportLobeIconRegex.MatchString(icon)
			validUploadedIcon := ok && validateUploadedSupportIcon(icon)
			if !ok || (!validSupportIcons[icon] && !validLobeIcon && !validUploadedIcon) {
				return fmt.Errorf("第%d个支持分类的第%d个入口图标不合法", categoryIndex+1, itemIndex+1)
			}
			for field, limit := range map[string]int{"label": 120, "description": 240} {
				if value, exists := item[field]; exists {
					valueString, ok := value.(string)
					if !ok || exceedsMaxCharacters(valueString, limit) {
						return fmt.Errorf("第%d个支持分类的第%d个入口%s格式不正确或过长", categoryIndex+1, itemIndex+1, field)
					}
				}
			}
		}
	}
	return nil
}

func GetSupportLinks() []map[string]interface{} {
	return getJSONList(GetConsoleSetting().SupportLinks)
}

func GetFooterConfig() *FooterConfig {
	value := GetConsoleSetting().Footer
	if strings.TrimSpace(value) == "" {
		return nil
	}
	footer, err := parseFooterConfig(value)
	if err != nil || validateFooterConfig(value) != nil {
		return nil
	}
	return &footer
}

func GetWalletPromotionConfig() *WalletPromotionConfig {
	value := GetConsoleSetting().WalletPromotion
	if strings.TrimSpace(value) == "" {
		return nil
	}
	promotion, err := parseWalletPromotionConfig(value)
	if err != nil || validateWalletPromotionConfig(value) != nil {
		return nil
	}
	return &promotion
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

		if exceedsMaxCharacters(urlStr, 500) {
			return fmt.Errorf("第%d个API信息的URL长度不能超过500字符", i+1)
		}
		if exceedsMaxCharacters(route, 100) {
			return fmt.Errorf("第%d个API信息的线路描述长度不能超过100字符", i+1)
		}
		if exceedsMaxCharacters(description, 200) {
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
		if exceedsMaxCharacters(content, 500) {
			return fmt.Errorf("第%d个公告的内容长度不能超过500字符", i+1)
		}
		if extra, exists := ann["extra"]; exists {
			if extraStr, ok := extra.(string); ok && exceedsMaxCharacters(extraStr, 100) {
				return fmt.Errorf("第%d个公告的说明长度不能超过100字符", i+1)
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
		if exceedsMaxCharacters(question, 200) {
			return fmt.Errorf("第%d个FAQ的问题长度不能超过200字符", i+1)
		}
		if exceedsMaxCharacters(answer, 1000) {
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

		if exceedsMaxCharacters(categoryName, 50) {
			return fmt.Errorf("第%d个分组的分类名称长度不能超过50字符", i+1)
		}
		if exceedsMaxCharacters(urlStr, 500) {
			return fmt.Errorf("第%d个分组的URL长度不能超过500字符", i+1)
		}
		if exceedsMaxCharacters(slug, 100) {
			return fmt.Errorf("第%d个分组的Slug长度不能超过100字符", i+1)
		}
		if exceedsMaxCharacters(description, 200) {
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

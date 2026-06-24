package system_setting

import (
	"strings"

	"github.com/QuantumNous/new-api/setting/config"
)

type LDAPSettings struct {
	Enabled         bool   `json:"enabled"`
	URL             string `json:"url"`
	BaseDN          string `json:"base_dn"`
	UserDN          string `json:"user_dn"`
	BindDN          string `json:"bind_dn"`
	BindPass        string `json:"bind_pass"`
	UserFilter      string `json:"user_filter"`
	UsernameAttr    string `json:"username_attr"`
	DisplayNameAttr string `json:"display_name_attr"`
	EmailAttr       string `json:"email_attr"`
	GroupFilter     string `json:"group_filter"`
	GroupNameAttr   string `json:"group_name_attr"`
	MemberAttr      string `json:"member_attr"`
	UseTLS          bool   `json:"use_tls"`
	Insecure        bool   `json:"insecure"`
	GroupWhitelist  string `json:"group_whitelist"`
	UserWhitelist   string `json:"user_whitelist"`
}

var defaultLDAPSettings = LDAPSettings{
	UserFilter:      "(&(objectClass=Person)(sAMAccountName=%s))",
	UsernameAttr:    "sAMAccountName",
	DisplayNameAttr: "cn",
	EmailAttr:       "mail",
	GroupFilter:     "(&(objectClass=group)(member=%s))",
	GroupNameAttr:   "cn",
	MemberAttr:      "member",
}

func init() {
	config.GlobalConfig.Register("ldap", &defaultLDAPSettings)
}

func GetLDAPSettings() *LDAPSettings {
	return &defaultLDAPSettings
}

func (s LDAPSettings) GroupWhitelistList() []string {
	return splitLDAPAccessList(s.GroupWhitelist, true)
}

func (s LDAPSettings) UserWhitelistList() []string {
	return splitLDAPAccessList(s.UserWhitelist, false)
}

func splitLDAPAccessList(value string, splitComma bool) []string {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	fields := strings.FieldsFunc(value, func(r rune) bool {
		return r == '\n' || r == '\r' || r == '\t' || (splitComma && r == ',')
	})
	items := make([]string, 0, len(fields))
	seen := make(map[string]struct{}, len(fields))
	for _, field := range fields {
		item := strings.TrimSpace(field)
		if item == "" {
			continue
		}
		if _, ok := seen[item]; ok {
			continue
		}
		seen[item] = struct{}{}
		items = append(items, item)
	}
	return items
}

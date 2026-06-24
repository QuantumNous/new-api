package controller

import (
	"strconv"

	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/system_setting"
)

var validateLDAPWhitelist = service.ValidateLDAPWhitelist

func validateLDAPWhitelistOption(key string, value string) error {
	settings := ldapSettingsFromOptionSnapshot(optionSnapshotWithOverride(key, value))
	switch key {
	case "ldap.group_whitelist":
		return validateLDAPWhitelist(settings, settings.GroupWhitelistList(), nil)
	case "ldap.user_whitelist":
		return validateLDAPWhitelist(settings, nil, settings.UserWhitelistList())
	default:
		return nil
	}
}

func ldapSettingsFromOptionSnapshot(options map[string]string) *system_setting.LDAPSettings {
	settings := *system_setting.GetLDAPSettings()
	for key, value := range options {
		switch key {
		case "ldap.enabled":
			settings.Enabled = parseLDAPBool(value, settings.Enabled)
		case "ldap.url":
			settings.URL = value
		case "ldap.base_dn":
			settings.BaseDN = value
		case "ldap.user_dn":
			settings.UserDN = value
		case "ldap.bind_dn":
			settings.BindDN = value
		case "ldap.bind_pass":
			settings.BindPass = value
		case "ldap.user_filter":
			settings.UserFilter = value
		case "ldap.username_attr":
			settings.UsernameAttr = value
		case "ldap.display_name_attr":
			settings.DisplayNameAttr = value
		case "ldap.email_attr":
			settings.EmailAttr = value
		case "ldap.group_filter":
			settings.GroupFilter = value
		case "ldap.group_name_attr":
			settings.GroupNameAttr = value
		case "ldap.member_attr":
			settings.MemberAttr = value
		case "ldap.use_tls":
			settings.UseTLS = parseLDAPBool(value, settings.UseTLS)
		case "ldap.insecure":
			settings.Insecure = parseLDAPBool(value, settings.Insecure)
		case "ldap.group_whitelist":
			settings.GroupWhitelist = value
		case "ldap.user_whitelist":
			settings.UserWhitelist = value
		}
	}
	return &settings
}

func parseLDAPBool(value string, fallback bool) bool {
	parsed, err := strconv.ParseBool(value)
	if err != nil {
		return fallback
	}
	return parsed
}

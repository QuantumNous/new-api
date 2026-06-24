package service

import (
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/go-ldap/ldap/v3"
)

type ldapSearcher interface {
	Search(searchRequest *ldap.SearchRequest) (*ldap.SearchResult, error)
}

func ValidateLDAPWhitelist(settings *system_setting.LDAPSettings, groupWhitelist []string, userWhitelist []string) error {
	groupWhitelist = compactStrings(groupWhitelist)
	userWhitelist = compactStrings(userWhitelist)
	if len(groupWhitelist) == 0 && len(userWhitelist) == 0 {
		return nil
	}
	if err := validateLDAPWhitelistSettings(settings, len(groupWhitelist) > 0, len(userWhitelist) > 0); err != nil {
		return err
	}

	conn, err := dialLDAP(settings)
	if err != nil {
		return err
	}
	defer conn.Close()

	if err := conn.Bind(settings.BindDN, settings.BindPass); err != nil {
		return fmt.Errorf("LDAP service bind failed: %w", err)
	}
	return validateLDAPWhitelistItems(settings, groupWhitelist, userWhitelist, conn)
}

func validateLDAPWhitelistSettings(settings *system_setting.LDAPSettings, needGroups bool, needUsers bool) error {
	if settings == nil {
		return errors.New("LDAP settings are required")
	}
	if strings.TrimSpace(settings.URL) == "" {
		return errors.New("LDAP URL is required")
	}
	if strings.TrimSpace(settings.BindDN) == "" || strings.TrimSpace(settings.BindPass) == "" {
		return errors.New("LDAP bind DN and password are required")
	}
	if needGroups && strings.TrimSpace(settings.BaseDN) == "" {
		return errors.New("LDAP base DN is required to validate group whitelist")
	}
	if needUsers {
		if strings.TrimSpace(settings.UserDN) == "" && strings.TrimSpace(settings.BaseDN) == "" {
			return errors.New("LDAP user DN or base DN is required to validate user whitelist")
		}
		if strings.TrimSpace(settings.UserFilter) == "" {
			return errors.New("LDAP user filter is required to validate user whitelist")
		}
	}
	return nil
}

func validateLDAPWhitelistItems(settings *system_setting.LDAPSettings, groupWhitelist []string, userWhitelist []string, searcher ldapSearcher) error {
	if settings == nil {
		return errors.New("LDAP settings are required")
	}
	settings = ldapSettingsWithLookupDefaults(settings)

	var invalidGroups []string
	for _, group := range groupWhitelist {
		ok, err := ldapGroupExists(searcher, settings, group)
		if err != nil {
			return err
		}
		if !ok {
			invalidGroups = append(invalidGroups, group)
		}
	}

	var invalidUsers []string
	for _, user := range userWhitelist {
		ok, err := ldapUserExists(searcher, settings, user)
		if err != nil {
			return err
		}
		if !ok {
			invalidUsers = append(invalidUsers, user)
		}
	}

	if len(invalidGroups) == 0 && len(invalidUsers) == 0 {
		return nil
	}
	parts := make([]string, 0, 2)
	if len(invalidGroups) > 0 {
		parts = append(parts, "无效 LDAP 白名单组: "+strings.Join(invalidGroups, ", "))
	}
	if len(invalidUsers) > 0 {
		parts = append(parts, "无效 LDAP 白名单用户: "+strings.Join(invalidUsers, ", "))
	}
	return errors.New(strings.Join(parts, "；"))
}

func ldapSettingsWithLookupDefaults(settings *system_setting.LDAPSettings) *system_setting.LDAPSettings {
	settingsCopy := *settings
	if strings.TrimSpace(settings.UserFilter) == "" {
		settingsCopy.UserFilter = "(&(objectClass=Person)(sAMAccountName=%s))"
	}
	if strings.TrimSpace(settings.UsernameAttr) == "" {
		settingsCopy.UsernameAttr = "sAMAccountName"
	}
	if strings.TrimSpace(settings.DisplayNameAttr) == "" {
		settingsCopy.DisplayNameAttr = "cn"
	}
	if strings.TrimSpace(settings.EmailAttr) == "" {
		settingsCopy.EmailAttr = "mail"
	}
	if strings.TrimSpace(settings.GroupNameAttr) == "" {
		settingsCopy.GroupNameAttr = "cn"
	}
	return &settingsCopy
}

func ldapGroupExists(searcher ldapSearcher, settings *system_setting.LDAPSettings, groupName string) (bool, error) {
	groupName = strings.TrimSpace(groupName)
	if groupName == "" {
		return true, nil
	}
	filter := fmt.Sprintf("(&(objectClass=group)(%s=%s))", settings.GroupNameAttr, ldap.EscapeFilter(groupName))
	result, err := searcher.Search(ldap.NewSearchRequest(
		settings.BaseDN,
		ldap.ScopeWholeSubtree,
		ldap.NeverDerefAliases,
		2,
		10,
		false,
		filter,
		[]string{settings.GroupNameAttr},
		nil,
	))
	if err != nil {
		return false, fmt.Errorf("LDAP group whitelist validation failed for %q: %w", groupName, err)
	}
	return len(result.Entries) > 0, nil
}

func ldapUserExists(searcher ldapSearcher, settings *system_setting.LDAPSettings, user string) (bool, error) {
	user = strings.TrimSpace(user)
	if user == "" {
		return true, nil
	}
	if _, err := ldap.ParseDN(user); err == nil {
		ok, err := ldapDNExists(searcher, user)
		if err != nil || ok {
			return ok, err
		}
	}
	if ok, err := ldapUserExistsByFilter(searcher, settings, fmt.Sprintf(settings.UserFilter, ldap.EscapeFilter(user))); err != nil || ok {
		return ok, err
	}
	if strings.Contains(user, "@") && strings.TrimSpace(settings.EmailAttr) != "" {
		return ldapUserExistsByFilter(searcher, settings, fmt.Sprintf("(%s=%s)", settings.EmailAttr, ldap.EscapeFilter(user)))
	}
	return false, nil
}

func ldapDNExists(searcher ldapSearcher, dn string) (bool, error) {
	result, err := searcher.Search(ldap.NewSearchRequest(
		dn,
		ldap.ScopeBaseObject,
		ldap.NeverDerefAliases,
		2,
		10,
		false,
		"(objectClass=*)",
		[]string{"dn"},
		nil,
	))
	if err != nil {
		if ldap.IsErrorWithCode(err, ldap.LDAPResultNoSuchObject) {
			return false, nil
		}
		return false, fmt.Errorf("LDAP user whitelist DN validation failed for %q: %w", dn, err)
	}
	return len(result.Entries) > 0, nil
}

func ldapUserExistsByFilter(searcher ldapSearcher, settings *system_setting.LDAPSettings, filter string) (bool, error) {
	searchBase := strings.TrimSpace(settings.UserDN)
	if searchBase == "" {
		searchBase = settings.BaseDN
	}
	result, err := searcher.Search(ldap.NewSearchRequest(
		searchBase,
		ldap.ScopeWholeSubtree,
		ldap.NeverDerefAliases,
		2,
		10,
		false,
		filter,
		compactStrings([]string{settings.UsernameAttr, settings.EmailAttr}),
		nil,
	))
	if err != nil {
		return false, fmt.Errorf("LDAP user whitelist validation failed for filter %q: %w", filter, err)
	}
	return len(result.Entries) > 0, nil
}

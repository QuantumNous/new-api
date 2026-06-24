package service

import (
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/go-ldap/ldap/v3"
)

type LDAPAuthenticatedUser struct {
	LDAPUserID  string
	Username    string
	DisplayName string
	Email       string
	Groups      []string
}

func AuthenticateLDAPUser(ctx context.Context, username, password string) (*LDAPAuthenticatedUser, error) {
	settings := system_setting.GetLDAPSettings()
	if err := validateLDAPSettings(settings); err != nil {
		return nil, err
	}
	if strings.TrimSpace(username) == "" || password == "" {
		return nil, errors.New("LDAP username and password are required")
	}

	conn, err := dialLDAP(settings)
	if err != nil {
		return nil, err
	}
	defer conn.Close()

	if err := conn.Bind(settings.BindDN, settings.BindPass); err != nil {
		return nil, fmt.Errorf("LDAP service bind failed: %w", err)
	}

	user, err := searchLDAPUser(conn, settings, username)
	if err != nil {
		return nil, err
	}

	userConn, err := dialLDAP(settings)
	if err != nil {
		return nil, err
	}
	defer userConn.Close()
	if err := userConn.Bind(user.LDAPUserID, password); err != nil {
		return nil, errors.New("LDAP username or password is invalid")
	}

	groups, err := searchLDAPGroupsRecursive(conn, settings, user.LDAPUserID, 8)
	if err != nil {
		return nil, err
	}
	if !IsLDAPAccessAllowed(user, groups, settings.UserWhitelistList(), settings.GroupWhitelistList(), 8) {
		return nil, errors.New("LDAP user is not allowed")
	}
	user.Groups = ldapGroupNames(groups)
	return user, nil
}

type LDAPGroup struct {
	DN        string
	Name      string
	MemberDNs []string
}

func IsLDAPGroupAllowed(userDN string, groups []LDAPGroup, whitelist []string, maxDepth int) bool {
	whitelistSet := make(map[string]struct{}, len(whitelist))
	for _, group := range whitelist {
		name := strings.TrimSpace(group)
		if name != "" {
			whitelistSet[strings.ToLower(name)] = struct{}{}
		}
	}
	if len(whitelistSet) == 0 {
		return true
	}
	if maxDepth <= 0 {
		maxDepth = 8
	}

	groupsByMemberDN := make(map[string][]LDAPGroup)
	for _, group := range groups {
		for _, memberDN := range group.MemberDNs {
			memberDN = strings.TrimSpace(memberDN)
			if memberDN == "" {
				continue
			}
			groupsByMemberDN[memberDN] = append(groupsByMemberDN[memberDN], group)
		}
	}

	visited := map[string]struct{}{}
	var walk func(memberDN string, depth int) bool
	walk = func(memberDN string, depth int) bool {
		if depth > maxDepth {
			return false
		}
		for _, group := range groupsByMemberDN[memberDN] {
			if _, ok := visited[group.DN]; ok {
				continue
			}
			visited[group.DN] = struct{}{}
			groupName := strings.ToLower(strings.TrimSpace(group.Name))
			if _, ok := whitelistSet[groupName]; ok {
				return true
			}
			if walk(group.DN, depth+1) {
				return true
			}
		}
		return false
	}
	return walk(strings.TrimSpace(userDN), 0)
}

func IsLDAPUserAllowed(user *LDAPAuthenticatedUser, whitelist []string) bool {
	if user == nil {
		return false
	}
	identifiers := compactStrings([]string{
		user.LDAPUserID,
		user.Username,
		user.Email,
	})
	for _, allowed := range whitelist {
		allowed = strings.TrimSpace(allowed)
		if allowed == "" {
			continue
		}
		for _, identifier := range identifiers {
			if strings.EqualFold(identifier, allowed) {
				return true
			}
		}
	}
	return false
}

func IsLDAPAccessAllowed(user *LDAPAuthenticatedUser, groups []LDAPGroup, userWhitelist []string, groupWhitelist []string, maxDepth int) bool {
	if len(userWhitelist) == 0 && len(groupWhitelist) == 0 {
		return true
	}
	if IsLDAPUserAllowed(user, userWhitelist) {
		return true
	}
	if len(groupWhitelist) > 0 && user != nil {
		return IsLDAPGroupAllowed(user.LDAPUserID, groups, groupWhitelist, maxDepth)
	}
	return false
}

func validateLDAPSettings(settings *system_setting.LDAPSettings) error {
	if settings == nil || !settings.Enabled {
		return errors.New("LDAP login is not enabled")
	}
	if strings.TrimSpace(settings.URL) == "" {
		return errors.New("LDAP URL is required")
	}
	if strings.TrimSpace(settings.BindDN) == "" || strings.TrimSpace(settings.BindPass) == "" {
		return errors.New("LDAP bind DN and password are required")
	}
	if strings.TrimSpace(settings.UserFilter) == "" {
		return errors.New("LDAP user filter is required")
	}
	if strings.TrimSpace(settings.UserDN) == "" && strings.TrimSpace(settings.BaseDN) == "" {
		return errors.New("LDAP user DN or base DN is required")
	}
	return nil
}

func dialLDAP(settings *system_setting.LDAPSettings) (*ldap.Conn, error) {
	tlsConfig := &tls.Config{InsecureSkipVerify: settings.Insecure}
	conn, err := ldap.DialURL(settings.URL, ldap.DialWithTLSConfig(tlsConfig))
	if err != nil {
		return nil, fmt.Errorf("LDAP connect failed: %w", err)
	}
	conn.SetTimeout(10 * time.Second)
	if settings.UseTLS && strings.HasPrefix(strings.ToLower(settings.URL), "ldap://") {
		if err := conn.StartTLS(tlsConfig); err != nil {
			conn.Close()
			return nil, fmt.Errorf("LDAP StartTLS failed: %w", err)
		}
	}
	return conn, nil
}

func searchLDAPUser(conn *ldap.Conn, settings *system_setting.LDAPSettings, username string) (*LDAPAuthenticatedUser, error) {
	searchBase := strings.TrimSpace(settings.UserDN)
	if searchBase == "" {
		searchBase = settings.BaseDN
	}
	filter := fmt.Sprintf(settings.UserFilter, ldap.EscapeFilter(username))
	attrs := compactStrings([]string{
		settings.UsernameAttr,
		settings.DisplayNameAttr,
		settings.EmailAttr,
	})

	result, err := conn.Search(ldap.NewSearchRequest(
		searchBase,
		ldap.ScopeWholeSubtree,
		ldap.NeverDerefAliases,
		2,
		10,
		false,
		filter,
		attrs,
		nil,
	))
	if err != nil {
		return nil, fmt.Errorf("LDAP user search failed: %w", err)
	}
	if len(result.Entries) != 1 {
		return nil, errors.New("LDAP user was not found")
	}

	entry := result.Entries[0]
	ldapUsername := entry.GetAttributeValue(settings.UsernameAttr)
	if ldapUsername == "" {
		ldapUsername = username
	}
	return &LDAPAuthenticatedUser{
		LDAPUserID:  entry.DN,
		Username:    ldapUsername,
		DisplayName: entry.GetAttributeValue(settings.DisplayNameAttr),
		Email:       entry.GetAttributeValue(settings.EmailAttr),
	}, nil
}

func searchLDAPGroupsRecursive(conn *ldap.Conn, settings *system_setting.LDAPSettings, userDN string, maxDepth int) ([]LDAPGroup, error) {
	if strings.TrimSpace(settings.GroupFilter) == "" || strings.TrimSpace(settings.BaseDN) == "" {
		return nil, nil
	}
	if maxDepth <= 0 {
		maxDepth = 8
	}
	var groups []LDAPGroup
	visited := map[string]struct{}{}

	var walk func(memberDN string, depth int) error
	walk = func(memberDN string, depth int) error {
		if depth > maxDepth {
			return nil
		}
		children, err := searchLDAPGroupsByMember(conn, settings, memberDN)
		if err != nil {
			return err
		}
		for _, group := range children {
			if _, ok := visited[group.DN]; ok {
				continue
			}
			visited[group.DN] = struct{}{}
			groups = append(groups, group)
			if err := walk(group.DN, depth+1); err != nil {
				return err
			}
		}
		return nil
	}

	if err := walk(userDN, 0); err != nil {
		return nil, err
	}
	return groups, nil
}

func searchLDAPGroupsByMember(conn *ldap.Conn, settings *system_setting.LDAPSettings, memberDN string) ([]LDAPGroup, error) {
	filter := fmt.Sprintf(settings.GroupFilter, ldap.EscapeFilter(memberDN))
	attrs := compactStrings([]string{
		settings.GroupNameAttr,
		settings.MemberAttr,
	})
	result, err := conn.Search(ldap.NewSearchRequest(
		settings.BaseDN,
		ldap.ScopeWholeSubtree,
		ldap.NeverDerefAliases,
		0,
		10,
		false,
		filter,
		attrs,
		nil,
	))
	if err != nil {
		return nil, fmt.Errorf("LDAP group search failed: %w", err)
	}

	groups := make([]LDAPGroup, 0, len(result.Entries))
	for _, entry := range result.Entries {
		name := entry.GetAttributeValue(settings.GroupNameAttr)
		if name == "" {
			name = entry.DN
		}
		groups = append(groups, LDAPGroup{
			DN:        entry.DN,
			Name:      name,
			MemberDNs: entry.GetAttributeValues(settings.MemberAttr),
		})
	}
	return groups, nil
}

func ldapGroupNames(groups []LDAPGroup) []string {
	names := make([]string, 0, len(groups))
	seen := make(map[string]struct{}, len(groups))
	for _, group := range groups {
		if group.Name == "" {
			continue
		}
		if _, ok := seen[group.Name]; ok {
			continue
		}
		seen[group.Name] = struct{}{}
		names = append(names, group.Name)
	}
	return names
}

func compactStrings(values []string) []string {
	out := make([]string, 0, len(values))
	seen := make(map[string]struct{}, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		out = append(out, value)
	}
	return out
}

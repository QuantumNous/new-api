package service

import (
	"errors"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/go-ldap/ldap/v3"
)

type fakeLDAPSearcher struct {
	search func(req *ldap.SearchRequest) (*ldap.SearchResult, error)
}

func (f fakeLDAPSearcher) Search(req *ldap.SearchRequest) (*ldap.SearchResult, error) {
	return f.search(req)
}

func TestValidateLDAPWhitelistItemsAcceptsExistingGroupsAndUsers(t *testing.T) {
	settings := &system_setting.LDAPSettings{
		BaseDN:        "OU=Company,DC=example,DC=com",
		UserDN:        "OU=Company,DC=example,DC=com",
		UserFilter:    "(&(objectClass=Person)(sAMAccountName=%s))",
		UsernameAttr:  "sAMAccountName",
		EmailAttr:     "mail",
		GroupNameAttr: "cn",
	}
	searcher := fakeLDAPSearcher{search: func(req *ldap.SearchRequest) (*ldap.SearchResult, error) {
		switch {
		case strings.Contains(req.Filter, "(cn=g-r&d-mtd)"):
			return &ldap.SearchResult{Entries: []*ldap.Entry{
				ldap.NewEntry("CN=G-R&D-MTD,OU=Groups,DC=example,DC=com", map[string][]string{"cn": {"G-R&D-MTD"}}),
			}}, nil
		case strings.Contains(req.Filter, "(sAMAccountName=conyong)"):
			return &ldap.SearchResult{Entries: []*ldap.Entry{
				ldap.NewEntry("CN=conyong,OU=Users,DC=example,DC=com", map[string][]string{"sAMAccountName": {"conyong"}}),
			}}, nil
		case strings.Contains(req.Filter, "(mail=yan@example.com)"):
			return &ldap.SearchResult{Entries: []*ldap.Entry{
				ldap.NewEntry("CN=yanyong,OU=Users,DC=example,DC=com", map[string][]string{"mail": {"yan@example.com"}}),
			}}, nil
		case req.Scope == ldap.ScopeBaseObject && req.BaseDN == "CN=direct,OU=Users,DC=example,DC=com":
			return &ldap.SearchResult{Entries: []*ldap.Entry{
				ldap.NewEntry("CN=direct,OU=Users,DC=example,DC=com", map[string][]string{"sAMAccountName": {"direct"}}),
			}}, nil
		default:
			return &ldap.SearchResult{}, nil
		}
	}}

	err := validateLDAPWhitelistItems(settings, []string{"g-r&d-mtd"}, []string{
		"conyong",
		"yan@example.com",
		"CN=direct,OU=Users,DC=example,DC=com",
	}, searcher)
	if err != nil {
		t.Fatalf("expected existing LDAP whitelist items to pass, got %v", err)
	}
}

func TestValidateLDAPWhitelistItemsRejectsMissingGroupsAndUsers(t *testing.T) {
	settings := &system_setting.LDAPSettings{
		BaseDN:        "OU=Company,DC=example,DC=com",
		UserDN:        "OU=Company,DC=example,DC=com",
		UserFilter:    "(&(objectClass=Person)(sAMAccountName=%s))",
		UsernameAttr:  "sAMAccountName",
		EmailAttr:     "mail",
		GroupNameAttr: "cn",
	}
	searcher := fakeLDAPSearcher{search: func(req *ldap.SearchRequest) (*ldap.SearchResult, error) {
		return &ldap.SearchResult{}, nil
	}}

	err := validateLDAPWhitelistItems(settings, []string{"g-missing"}, []string{"missing-user"}, searcher)
	if err == nil {
		t.Fatal("expected missing LDAP whitelist items to fail")
	}
	if !strings.Contains(err.Error(), "g-missing") || !strings.Contains(err.Error(), "missing-user") {
		t.Fatalf("expected error to include invalid items, got %v", err)
	}
}

func TestValidateLDAPWhitelistItemsTreatsMissingDNAsInvalidUser(t *testing.T) {
	settings := &system_setting.LDAPSettings{
		BaseDN:        "OU=Company,DC=example,DC=com",
		UserDN:        "OU=Company,DC=example,DC=com",
		UserFilter:    "(&(objectClass=Person)(sAMAccountName=%s))",
		UsernameAttr:  "sAMAccountName",
		EmailAttr:     "mail",
		GroupNameAttr: "cn",
	}
	searcher := fakeLDAPSearcher{search: func(req *ldap.SearchRequest) (*ldap.SearchResult, error) {
		if req.Scope == ldap.ScopeBaseObject {
			return nil, ldap.NewError(ldap.LDAPResultNoSuchObject, errors.New("not found"))
		}
		return &ldap.SearchResult{}, nil
	}}

	err := validateLDAPWhitelistItems(settings, nil, []string{"CN=missing,OU=Users,DC=example,DC=com"}, searcher)
	if err == nil {
		t.Fatal("expected missing LDAP DN whitelist item to fail")
	}
	if !strings.Contains(err.Error(), "无效 LDAP 白名单用户") || !strings.Contains(err.Error(), "CN=missing,OU=Users,DC=example,DC=com") {
		t.Fatalf("expected error to include missing DN, got %v", err)
	}
}

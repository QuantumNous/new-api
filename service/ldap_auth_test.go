package service

import "testing"

func TestLDAPGroupWhitelistAllowsEmptyWhitelist(t *testing.T) {
	allowed := IsLDAPGroupAllowed("CN=Alice,OU=Users,DC=example,DC=com", nil, nil, 8)
	if !allowed {
		t.Fatal("empty whitelist should allow authenticated LDAP user")
	}
}

func TestLDAPGroupWhitelistAllowsDirectGroup(t *testing.T) {
	groups := []LDAPGroup{
		{
			DN:        "CN=g-ai,OU=Groups,DC=example,DC=com",
			Name:      "G-AI",
			MemberDNs: []string{"CN=Alice,OU=Users,DC=example,DC=com"},
		},
	}

	allowed := IsLDAPGroupAllowed("CN=Alice,OU=Users,DC=example,DC=com", groups, []string{"g-ai"}, 8)
	if !allowed {
		t.Fatal("direct LDAP group should satisfy whitelist")
	}
}

func TestLDAPGroupWhitelistAllowsNestedGroup(t *testing.T) {
	groups := []LDAPGroup{
		{
			DN:        "CN=g-engineering,OU=Groups,DC=example,DC=com",
			Name:      "g-engineering",
			MemberDNs: []string{"CN=Alice,OU=Users,DC=example,DC=com"},
		},
		{
			DN:        "CN=g-ai,OU=Groups,DC=example,DC=com",
			Name:      "G-AI",
			MemberDNs: []string{"CN=g-engineering,OU=Groups,DC=example,DC=com"},
		},
	}

	allowed := IsLDAPGroupAllowed("CN=Alice,OU=Users,DC=example,DC=com", groups, []string{"g-ai"}, 8)
	if !allowed {
		t.Fatal("nested LDAP group should satisfy whitelist")
	}
}

func TestLDAPGroupWhitelistRejectsMiss(t *testing.T) {
	groups := []LDAPGroup{
		{
			DN:        "CN=g-engineering,OU=Groups,DC=example,DC=com",
			Name:      "g-engineering",
			MemberDNs: []string{"CN=Alice,OU=Users,DC=example,DC=com"},
		},
	}

	allowed := IsLDAPGroupAllowed("CN=Alice,OU=Users,DC=example,DC=com", groups, []string{"g-ai"}, 8)
	if allowed {
		t.Fatal("non-matching LDAP group should not satisfy whitelist")
	}
}

func TestLDAPGroupWhitelistHandlesCycles(t *testing.T) {
	groups := []LDAPGroup{
		{
			DN:        "CN=g-a,OU=Groups,DC=example,DC=com",
			Name:      "g-a",
			MemberDNs: []string{"CN=Alice,OU=Users,DC=example,DC=com", "CN=g-b,OU=Groups,DC=example,DC=com"},
		},
		{
			DN:        "CN=g-b,OU=Groups,DC=example,DC=com",
			Name:      "g-b",
			MemberDNs: []string{"CN=g-a,OU=Groups,DC=example,DC=com"},
		},
	}

	allowed := IsLDAPGroupAllowed("CN=Alice,OU=Users,DC=example,DC=com", groups, []string{"g-missing"}, 8)
	if allowed {
		t.Fatal("cycle without whitelisted group should not satisfy whitelist")
	}
}

func TestLDAPUserWhitelistAllowsUsernameEmailOrDN(t *testing.T) {
	user := &LDAPAuthenticatedUser{
		LDAPUserID: "CN=Alice,OU=Users,DC=example,DC=com",
		Username:   "alice",
		Email:      "alice@example.com",
	}

	for _, whitelist := range [][]string{
		{"alice"},
		{"ALICE@EXAMPLE.COM"},
		{"cn=alice,ou=users,dc=example,dc=com"},
	} {
		if !IsLDAPUserAllowed(user, whitelist) {
			t.Fatalf("expected user whitelist %#v to allow LDAP user", whitelist)
		}
	}
}

func TestLDAPAccessWhitelistAllowsUserOrGroup(t *testing.T) {
	user := &LDAPAuthenticatedUser{
		LDAPUserID: "CN=Alice,OU=Users,DC=example,DC=com",
		Username:   "alice",
		Email:      "alice@example.com",
	}
	groups := []LDAPGroup{
		{
			DN:        "CN=g-engineering,OU=Groups,DC=example,DC=com",
			Name:      "g-engineering",
			MemberDNs: []string{user.LDAPUserID},
		},
	}

	if !IsLDAPAccessAllowed(user, groups, []string{"alice"}, []string{"g-missing"}, 8) {
		t.Fatal("matching user whitelist should allow LDAP access")
	}
	if !IsLDAPAccessAllowed(user, groups, []string{"bob"}, []string{"g-engineering"}, 8) {
		t.Fatal("matching group whitelist should allow LDAP access")
	}
	if IsLDAPAccessAllowed(user, groups, []string{"bob"}, []string{"g-missing"}, 8) {
		t.Fatal("non-matching user and group whitelist should reject LDAP access")
	}
}

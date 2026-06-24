package system_setting

import "testing"

func TestLDAPSettingsGroupWhitelist(t *testing.T) {
	settings := LDAPSettings{
		GroupWhitelist: " g-admins, g-dev\n\ng-ai ",
	}

	got := settings.GroupWhitelistList()
	want := []string{"g-admins", "g-dev", "g-ai"}
	if len(got) != len(want) {
		t.Fatalf("expected %d groups, got %d: %#v", len(want), len(got), got)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("group %d mismatch: want %q, got %q", i, want[i], got[i])
		}
	}
}

func TestLDAPSettingsUserWhitelist(t *testing.T) {
	settings := LDAPSettings{
		UserWhitelist: " alice\nbob@example.com\nCN=Carol,OU=Users,DC=example,DC=com ",
	}

	got := settings.UserWhitelistList()
	want := []string{"alice", "bob@example.com", "CN=Carol,OU=Users,DC=example,DC=com"}
	if len(got) != len(want) {
		t.Fatalf("expected %d users, got %d: %#v", len(want), len(got), got)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("user %d mismatch: want %q, got %q", i, want[i], got[i])
		}
	}
}

func TestLDAPSettingsDefaults(t *testing.T) {
	settings := GetLDAPSettings()
	if settings.UsernameAttr != "sAMAccountName" {
		t.Fatalf("expected default username attr sAMAccountName, got %q", settings.UsernameAttr)
	}
	if settings.DisplayNameAttr != "cn" {
		t.Fatalf("expected default display attr cn, got %q", settings.DisplayNameAttr)
	}
	if settings.EmailAttr != "mail" {
		t.Fatalf("expected default email attr mail, got %q", settings.EmailAttr)
	}
	if settings.GroupNameAttr != "cn" {
		t.Fatalf("expected default group name attr cn, got %q", settings.GroupNameAttr)
	}
	if settings.MemberAttr != "member" {
		t.Fatalf("expected default member attr member, got %q", settings.MemberAttr)
	}
}

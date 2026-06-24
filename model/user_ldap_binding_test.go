package model

import (
	"testing"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func setupUserLDAPBindingTestDB(t *testing.T) {
	t.Helper()

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&User{}, &UserLDAPBinding{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	DB = db
}

func TestUserLDAPBindingCreateAndLookup(t *testing.T) {
	setupUserLDAPBindingTestDB(t)

	user := User{Username: "ldap_user", Password: "password", DisplayName: "LDAP User", AffCode: "a001"}
	if err := DB.Create(&user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}

	binding := &UserLDAPBinding{
		UserId:       user.Id,
		LDAPUserId:   "CN=LDAP User,OU=Company,DC=example,DC=com",
		LDAPUsername: "ldap_user",
	}
	if err := CreateUserLDAPBinding(binding); err != nil {
		t.Fatalf("create binding: %v", err)
	}

	found, err := GetUserByLDAPBinding(binding.LDAPUserId)
	if err != nil {
		t.Fatalf("lookup user by ldap binding: %v", err)
	}
	if found.Id != user.Id {
		t.Fatalf("expected user id %d, got %d", user.Id, found.Id)
	}
}

func TestUserLDAPBindingRejectsDuplicateLDAPUserID(t *testing.T) {
	setupUserLDAPBindingTestDB(t)

	user1 := User{Username: "ldap_user_1", Password: "password", AffCode: "a001"}
	user2 := User{Username: "ldap_user_2", Password: "password", AffCode: "a002"}
	if err := DB.Create(&user1).Error; err != nil {
		t.Fatalf("create user1: %v", err)
	}
	if err := DB.Create(&user2).Error; err != nil {
		t.Fatalf("create user2: %v", err)
	}

	ldapUserID := "CN=Duplicate,OU=Company,DC=example,DC=com"
	if err := CreateUserLDAPBinding(&UserLDAPBinding{UserId: user1.Id, LDAPUserId: ldapUserID}); err != nil {
		t.Fatalf("create first binding: %v", err)
	}
	if err := CreateUserLDAPBinding(&UserLDAPBinding{UserId: user2.Id, LDAPUserId: ldapUserID}); err == nil {
		t.Fatal("expected duplicate ldap user id to fail")
	}
}

func TestUserLDAPBindingStoresLDAPSnapshot(t *testing.T) {
	setupUserLDAPBindingTestDB(t)

	user := User{Username: "ldap_snapshot", Password: "password", AffCode: "a003"}
	if err := DB.Create(&user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}

	binding := &UserLDAPBinding{
		UserId:          user.Id,
		LDAPUserId:      "CN=Snapshot,OU=Company,DC=example,DC=com",
		LDAPUsername:    "snapshot",
		LDAPDisplayName: "Snapshot User",
		LDAPEmail:       "snapshot@example.com",
	}
	if err := binding.SetGroups([]string{"g-engineering", "g-ai"}); err != nil {
		t.Fatalf("set groups: %v", err)
	}
	if err := CreateUserLDAPBinding(binding); err != nil {
		t.Fatalf("create binding: %v", err)
	}

	found, err := GetUserLDAPBindingByUserId(user.Id)
	if err != nil {
		t.Fatalf("get binding: %v", err)
	}
	if found.LDAPDisplayName != "Snapshot User" {
		t.Fatalf("expected display name snapshot, got %q", found.LDAPDisplayName)
	}
	groups := found.GroupList()
	if len(groups) != 2 || groups[0] != "g-engineering" || groups[1] != "g-ai" {
		t.Fatalf("expected LDAP groups snapshot, got %#v", groups)
	}
	if found.LastSyncTime == 0 {
		t.Fatal("expected last sync time to be recorded")
	}
}

package controller

import (
	"bytes"
	"errors"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
)

func TestSensitiveOptionKeyIncludesLDAPBindPass(t *testing.T) {
	if !isSensitiveOptionKey("ldap.bind_pass") {
		t.Fatal("ldap.bind_pass must be treated as sensitive")
	}
}

func TestLDAPEnableValidationRequiresConnectionSettings(t *testing.T) {
	err := validateLDAPEnable("true", map[string]string{
		"ldap.url":         "",
		"ldap.bind_dn":     "ldap-reader",
		"ldap.bind_pass":   "secret",
		"ldap.user_filter": "(&(objectClass=Person)(sAMAccountName=%s))",
		"ldap.user_dn":     "OU=Users,DC=example,DC=com",
	})
	if err == nil {
		t.Fatal("expected enabling LDAP without URL to fail")
	}

	err = validateLDAPEnable("true", map[string]string{
		"ldap.url":         "ldap://ldap.example.com:389",
		"ldap.bind_dn":     "ldap-reader",
		"ldap.bind_pass":   "secret",
		"ldap.user_filter": "(&(objectClass=Person)(sAMAccountName=%s))",
		"ldap.user_dn":     "OU=Users,DC=example,DC=com",
	})
	if err != nil {
		t.Fatalf("expected complete LDAP settings to allow enable, got %v", err)
	}
}

func TestValidateLDAPWhitelistOptionParsesGroupList(t *testing.T) {
	withLDAPOptionMap(t)
	oldValidator := validateLDAPWhitelist
	t.Cleanup(func() {
		validateLDAPWhitelist = oldValidator
	})

	var gotSettings *system_setting.LDAPSettings
	var gotGroups []string
	var gotUsers []string
	validateLDAPWhitelist = func(settings *system_setting.LDAPSettings, groups []string, users []string) error {
		gotSettings = settings
		gotGroups = groups
		gotUsers = users
		return nil
	}

	err := validateLDAPWhitelistOption("ldap.group_whitelist", "g-r&d-mtd, g-software\nG-IOT")
	if err != nil {
		t.Fatalf("expected group whitelist validation to pass, got %v", err)
	}
	if gotSettings == nil || gotSettings.URL != "ldap://ldap.example.com:389" || gotSettings.BaseDN != "OU=Company,DC=example,DC=com" {
		t.Fatalf("expected LDAP settings snapshot to be passed, got %#v", gotSettings)
	}
	if !reflect.DeepEqual(gotGroups, []string{"g-r&d-mtd", "g-software", "G-IOT"}) {
		t.Fatalf("unexpected group whitelist items: %#v", gotGroups)
	}
	if len(gotUsers) != 0 {
		t.Fatalf("user whitelist should not be validated when saving group whitelist, got %#v", gotUsers)
	}
}

func TestValidateLDAPWhitelistOptionKeepsUserDNCommas(t *testing.T) {
	withLDAPOptionMap(t)
	oldValidator := validateLDAPWhitelist
	t.Cleanup(func() {
		validateLDAPWhitelist = oldValidator
	})

	var gotGroups []string
	var gotUsers []string
	validateLDAPWhitelist = func(settings *system_setting.LDAPSettings, groups []string, users []string) error {
		gotGroups = groups
		gotUsers = users
		return nil
	}

	err := validateLDAPWhitelistOption("ldap.user_whitelist", "conyong\nCN=Carol,OU=Users,DC=example,DC=com")
	if err != nil {
		t.Fatalf("expected user whitelist validation to pass, got %v", err)
	}
	if len(gotGroups) != 0 {
		t.Fatalf("group whitelist should not be validated when saving user whitelist, got %#v", gotGroups)
	}
	wantUsers := []string{"conyong", "CN=Carol,OU=Users,DC=example,DC=com"}
	if !reflect.DeepEqual(gotUsers, wantUsers) {
		t.Fatalf("unexpected user whitelist items: want %#v, got %#v", wantUsers, gotUsers)
	}
}

func TestValidateLDAPWhitelistOptionReturnsValidationError(t *testing.T) {
	withLDAPOptionMap(t)
	oldValidator := validateLDAPWhitelist
	t.Cleanup(func() {
		validateLDAPWhitelist = oldValidator
	})

	wantErr := errors.New("invalid LDAP whitelist")
	validateLDAPWhitelist = func(settings *system_setting.LDAPSettings, groups []string, users []string) error {
		return wantErr
	}

	err := validateLDAPWhitelistOption("ldap.group_whitelist", "g-missing")
	if !errors.Is(err, wantErr) {
		t.Fatalf("expected validation error %v, got %v", wantErr, err)
	}
}

func TestUpdateOptionRejectsInvalidLDAPGroupWhitelist(t *testing.T) {
	withLDAPOptionMap(t)
	oldValidator := validateLDAPWhitelist
	t.Cleanup(func() {
		validateLDAPWhitelist = oldValidator
	})

	validateLDAPWhitelist = func(settings *system_setting.LDAPSettings, groups []string, users []string) error {
		return errors.New("无效 LDAP 白名单组: g-missing")
	}

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(
		http.MethodPut,
		"/api/option/",
		bytes.NewBufferString(`{"key":"ldap.group_whitelist","value":"g-missing"}`),
	)

	UpdateOption(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", recorder.Code)
	}
	if !strings.Contains(recorder.Body.String(), `"success":false`) {
		t.Fatalf("expected failed response, got %s", recorder.Body.String())
	}
	if !strings.Contains(recorder.Body.String(), "g-missing") {
		t.Fatalf("expected invalid item in response, got %s", recorder.Body.String())
	}
	common.OptionMapRWMutex.RLock()
	defer common.OptionMapRWMutex.RUnlock()
	if common.OptionMap["ldap.group_whitelist"] == "g-missing" {
		t.Fatal("invalid LDAP group whitelist must not be saved")
	}
}

func TestUpdateOptionRejectsInvalidLDAPUserWhitelist(t *testing.T) {
	withLDAPOptionMap(t)
	oldValidator := validateLDAPWhitelist
	t.Cleanup(func() {
		validateLDAPWhitelist = oldValidator
	})

	validateLDAPWhitelist = func(settings *system_setting.LDAPSettings, groups []string, users []string) error {
		return errors.New("无效 LDAP 白名单用户: missing-user")
	}

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(
		http.MethodPut,
		"/api/option/",
		bytes.NewBufferString(`{"key":"ldap.user_whitelist","value":"missing-user"}`),
	)

	UpdateOption(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", recorder.Code)
	}
	if !strings.Contains(recorder.Body.String(), `"success":false`) {
		t.Fatalf("expected failed response, got %s", recorder.Body.String())
	}
	if !strings.Contains(recorder.Body.String(), "missing-user") {
		t.Fatalf("expected invalid item in response, got %s", recorder.Body.String())
	}
	common.OptionMapRWMutex.RLock()
	defer common.OptionMapRWMutex.RUnlock()
	if common.OptionMap["ldap.user_whitelist"] == "missing-user" {
		t.Fatal("invalid LDAP user whitelist must not be saved")
	}
}

func withLDAPOptionMap(t *testing.T) {
	t.Helper()
	common.OptionMapRWMutex.Lock()
	oldOptionMap := common.OptionMap
	common.OptionMap = map[string]string{
		"ldap.enabled":         "true",
		"ldap.url":             "ldap://ldap.example.com:389",
		"ldap.base_dn":         "OU=Company,DC=example,DC=com",
		"ldap.user_dn":         "OU=Company,DC=example,DC=com",
		"ldap.bind_dn":         "ldap-reader",
		"ldap.bind_pass":       "secret",
		"ldap.user_filter":     "(&(objectClass=Person)(sAMAccountName=%s))",
		"ldap.username_attr":   "sAMAccountName",
		"ldap.email_attr":      "mail",
		"ldap.group_name_attr": "cn",
	}
	common.OptionMapRWMutex.Unlock()
	t.Cleanup(func() {
		common.OptionMapRWMutex.Lock()
		common.OptionMap = oldOptionMap
		common.OptionMapRWMutex.Unlock()
	})
}

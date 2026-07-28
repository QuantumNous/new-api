package common

import (
	"errors"
	"sort"
	"strings"
	"sync"
)

const (
	InvitationCodeMaxLength = 128

	InvitationRegistrationMethodPassword    = "password"
	InvitationRegistrationMethodGitHub      = "github"
	InvitationRegistrationMethodDiscord     = "discord"
	InvitationRegistrationMethodLinuxDO     = "linuxdo"
	InvitationRegistrationMethodOIDC        = "oidc"
	InvitationRegistrationMethodCustomOAuth = "custom_oauth"
	InvitationRegistrationMethodWeChat      = "wechat"
)

var invitationRegistrationMethods = map[string]struct{}{
	InvitationRegistrationMethodPassword:    {},
	InvitationRegistrationMethodGitHub:      {},
	InvitationRegistrationMethodDiscord:     {},
	InvitationRegistrationMethodLinuxDO:     {},
	InvitationRegistrationMethodOIDC:        {},
	InvitationRegistrationMethodCustomOAuth: {},
	InvitationRegistrationMethodWeChat:      {},
}

var invitationSettings = struct {
	sync.RWMutex
	required bool
	methods  map[string]struct{}
}{
	methods: map[string]struct{}{
		InvitationRegistrationMethodLinuxDO: {},
	},
}

type InvitationCodeSettings struct {
	Required bool     `json:"required"`
	Methods  []string `json:"methods"`
}

func (settings InvitationCodeSettings) Requires(method string) bool {
	if !settings.Required {
		return false
	}
	method = strings.ToLower(strings.TrimSpace(method))
	for _, configuredMethod := range settings.Methods {
		if strings.ToLower(strings.TrimSpace(configuredMethod)) == method {
			return true
		}
	}
	return false
}

func DefaultInvitationCodeSettings() InvitationCodeSettings {
	return InvitationCodeSettings{
		Required: false,
		Methods:  []string{InvitationRegistrationMethodLinuxDO},
	}
}

func NormalizeInvitationCodeSettings(required bool, methods []string) (InvitationCodeSettings, error) {
	normalized := make(map[string]struct{}, len(methods))
	for _, method := range methods {
		method = strings.ToLower(strings.TrimSpace(method))
		if _, ok := invitationRegistrationMethods[method]; !ok {
			return InvitationCodeSettings{}, errors.New("unsupported invitation registration method: " + method)
		}
		normalized[method] = struct{}{}
	}
	if required && len(normalized) == 0 {
		return InvitationCodeSettings{}, errors.New("at least one invitation registration method is required when invitation codes are enabled")
	}

	normalizedMethods := make([]string, 0, len(normalized))
	for method := range normalized {
		normalizedMethods = append(normalizedMethods, method)
	}
	sort.Strings(normalizedMethods)
	return InvitationCodeSettings{
		Required: required,
		Methods:  normalizedMethods,
	}, nil
}

func ApplyInvitationCodeSettings(required bool, methods []string) (InvitationCodeSettings, error) {
	normalized, err := NormalizeInvitationCodeSettings(required, methods)
	if err != nil {
		return InvitationCodeSettings{}, err
	}

	invitationSettings.Lock()
	defer invitationSettings.Unlock()
	invitationSettings.required = normalized.Required
	invitationSettings.methods = make(map[string]struct{}, len(normalized.Methods))
	for _, method := range normalized.Methods {
		invitationSettings.methods[method] = struct{}{}
	}
	return normalized, nil
}

func GetInvitationCodeSettings() InvitationCodeSettings {
	invitationSettings.RLock()
	defer invitationSettings.RUnlock()

	methods := make([]string, 0, len(invitationSettings.methods))
	for method := range invitationSettings.methods {
		methods = append(methods, method)
	}
	sort.Strings(methods)
	return InvitationCodeSettings{
		Required: invitationSettings.required,
		Methods:  methods,
	}
}

func SetInvitationCodeRequired(required bool) error {
	invitationSettings.Lock()
	defer invitationSettings.Unlock()
	if required && len(invitationSettings.methods) == 0 {
		return errors.New("at least one invitation registration method is required when invitation codes are enabled")
	}
	invitationSettings.required = required
	return nil
}

func IsInvitationCodeRequired() bool {
	invitationSettings.RLock()
	defer invitationSettings.RUnlock()
	return invitationSettings.required
}

func IsInvitationCodeRequiredFor(method string) bool {
	return GetInvitationCodeSettings().Requires(method)
}

func IsValidInvitationRegistrationMethod(method string) bool {
	_, ok := invitationRegistrationMethods[strings.ToLower(strings.TrimSpace(method))]
	return ok
}

func SetInvitationCodeMethods(methods []string) error {
	normalized, err := NormalizeInvitationCodeSettings(false, methods)
	if err != nil {
		return err
	}

	invitationSettings.Lock()
	defer invitationSettings.Unlock()
	if invitationSettings.required && len(normalized.Methods) == 0 {
		return errors.New("at least one invitation registration method is required when invitation codes are enabled")
	}
	invitationSettings.methods = make(map[string]struct{}, len(normalized.Methods))
	for _, method := range normalized.Methods {
		invitationSettings.methods[method] = struct{}{}
	}
	return nil
}

func SetInvitationCodeMethodsJSON(value string) error {
	methods, err := ParseInvitationCodeMethodsJSON(value)
	if err != nil {
		return err
	}
	return SetInvitationCodeMethods(methods)
}

func ParseInvitationCodeMethodsJSON(value string) ([]string, error) {
	trimmed := strings.TrimSpace(value)
	if len(trimmed) == 0 || trimmed[0] != '[' {
		return nil, errors.New("invitation registration methods must be a JSON array")
	}
	var methods []string
	if err := UnmarshalJsonStr(value, &methods); err != nil {
		return nil, err
	}
	normalized, err := NormalizeInvitationCodeSettings(false, methods)
	if err != nil {
		return nil, err
	}
	return normalized.Methods, nil
}

func GetInvitationCodeMethods() []string {
	return GetInvitationCodeSettings().Methods
}

func InvitationCodeMethodsJSON() string {
	data, err := Marshal(GetInvitationCodeMethods())
	if err != nil {
		return "[]"
	}
	return string(data)
}

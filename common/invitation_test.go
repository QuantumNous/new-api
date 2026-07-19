package common

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestInvitationCodeSettingsAreMethodScoped(t *testing.T) {
	original := GetInvitationCodeSettings()
	t.Cleanup(func() {
		_, err := ApplyInvitationCodeSettings(original.Required, original.Methods)
		require.NoError(t, err)
	})

	settings, err := ApplyInvitationCodeSettings(true, []string{
		InvitationRegistrationMethodLinuxDO,
		InvitationRegistrationMethodPassword,
		InvitationRegistrationMethodLinuxDO,
	})
	require.NoError(t, err)

	assert.True(t, IsInvitationCodeRequiredFor(InvitationRegistrationMethodLinuxDO))
	assert.True(t, IsInvitationCodeRequiredFor(InvitationRegistrationMethodPassword))
	assert.False(t, IsInvitationCodeRequiredFor(InvitationRegistrationMethodGitHub))
	assert.Equal(t, InvitationCodeSettings{
		Required: true,
		Methods:  []string{"linuxdo", "password"},
	}, settings)
	assert.Equal(t, settings, GetInvitationCodeSettings())

	require.NoError(t, SetInvitationCodeRequired(false))
	assert.False(t, IsInvitationCodeRequiredFor(InvitationRegistrationMethodLinuxDO))
}

func TestSetInvitationCodeMethodsJSONRejectsUnsupportedMethods(t *testing.T) {
	original := GetInvitationCodeSettings()
	t.Cleanup(func() {
		_, err := ApplyInvitationCodeSettings(original.Required, original.Methods)
		require.NoError(t, err)
	})

	require.NoError(t, SetInvitationCodeMethodsJSON(`["github","custom_oauth"]`))
	assert.Equal(t, []string{"custom_oauth", "github"}, GetInvitationCodeMethods())
	require.Error(t, SetInvitationCodeMethodsJSON(`["github","unknown"]`))
	assert.Equal(t, []string{"custom_oauth", "github"}, GetInvitationCodeMethods())
}

func TestApplyInvitationCodeSettingsRejectsRequiredWithoutMethodsAndPreservesState(t *testing.T) {
	original := GetInvitationCodeSettings()
	t.Cleanup(func() {
		_, err := ApplyInvitationCodeSettings(original.Required, original.Methods)
		require.NoError(t, err)
	})

	before, err := ApplyInvitationCodeSettings(false, []string{InvitationRegistrationMethodGitHub})
	require.NoError(t, err)

	_, err = ApplyInvitationCodeSettings(true, nil)
	require.Error(t, err)
	assert.Equal(t, before, GetInvitationCodeSettings())
}

func TestInvitationCodeSettingsRequiresNormalizesMethod(t *testing.T) {
	settings := InvitationCodeSettings{
		Required: true,
		Methods:  []string{InvitationRegistrationMethodPassword, InvitationRegistrationMethodLinuxDO},
	}
	assert.True(t, settings.Requires(" PASSWORD "))
	assert.True(t, settings.Requires("LinuxDO"))
	assert.False(t, settings.Requires(InvitationRegistrationMethodGitHub))
	settings.Required = false
	assert.False(t, settings.Requires(InvitationRegistrationMethodPassword))
}

func TestNormalizeInvitationCodeSettingsRejectsUnknownMethod(t *testing.T) {
	_, err := NormalizeInvitationCodeSettings(false, []string{"github", "unknown"})
	require.Error(t, err)
}

func TestInvitationCodeSettingsAllowDisabledWithExplicitEmptyMethods(t *testing.T) {
	original := GetInvitationCodeSettings()
	t.Cleanup(func() {
		_, err := ApplyInvitationCodeSettings(original.Required, original.Methods)
		require.NoError(t, err)
	})

	settings, err := ApplyInvitationCodeSettings(false, []string{})
	require.NoError(t, err)
	assert.False(t, settings.Required)
	assert.Empty(t, settings.Methods)
	assert.Equal(t, settings, GetInvitationCodeSettings())
}

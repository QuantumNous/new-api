package service

import (
	"net/url"
	"testing"

	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestBuildMjImageForwardURLIsSignedCapability(t *testing.T) {
	previousAddress := system_setting.ServerAddress
	system_setting.ServerAddress = "https://gw.example.com"
	t.Cleanup(func() { system_setting.ServerAddress = previousAddress })

	const mjId = "task-abc-123"
	built, err := url.Parse(BuildMjImageForwardURL(mjId))
	require.NoError(t, err)

	assert.Equal(t, "https", built.Scheme)
	assert.Equal(t, "gw.example.com", built.Host)
	assert.Equal(t, "/mj/image/"+mjId, built.Path)

	sig := built.Query().Get("sig")
	require.NotEmpty(t, sig)
	// A URL minted by the server verifies for its own task id.
	assert.True(t, VerifyMjImageSignature(mjId, sig))
}

func TestVerifyMjImageSignatureRejectsForgery(t *testing.T) {
	const owner = "owner-task"
	const other = "victim-task"
	ownerSig := mjImageSignature(owner)

	tests := []struct {
		name string
		mjId string
		sig  string
		want bool
	}{
		{"correct signature", owner, ownerSig, true},
		{"empty signature", owner, "", false},
		{"garbage signature", owner, "deadbeef", false},
		{"signature minted for another task", other, ownerSig, false},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.want, VerifyMjImageSignature(tc.mjId, tc.sig))
		})
	}
}

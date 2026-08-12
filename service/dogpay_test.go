package service

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestVerifyDogPayWebhookSignature(t *testing.T) {
	signature := "b42af09057bac1e2d41708e48a902e09b5ff7f12ab428a4fe86653c73dd248fb82f948a549f7b791a5b41915ee4d1ec3935357e4e2317250d0372afa2ebeeb3a"
	payload := []byte("The quick brown fox jumps over the lazy dog")

	require.True(t, VerifyDogPayWebhookSignature("key", payload, signature))
	require.False(t, VerifyDogPayWebhookSignature("key", payload, "B42AF09057BAC1E2D41708E48A902E09B5FF7F12AB428A4FE86653C73DD248FB82F948A549F7B791A5B41915EE4D1EC3935357E4E2317250D0372AFA2EBEEB3A"))
	require.False(t, VerifyDogPayWebhookSignature("key", payload, " "+signature))
	require.False(t, VerifyDogPayWebhookSignature("key", []byte("tampered"), signature))
	require.False(t, VerifyDogPayWebhookSignature("wrong-key", payload, signature))
}

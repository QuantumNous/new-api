package model

import (
	"encoding/base64"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/pkg/billingexpr"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTaskPrivateDataEncryptedWriteGatePreservesReaderFirstCompatibility(t *testing.T) {
	body := []byte(`{"prompt":"reader-first-prompt"}`)
	privateData := TaskPrivateData{BillingContext: &TaskBillingContext{BillingRequestInput: &billingexpr.RequestInput{
		Headers: map[string]string{"X-Trace-Id": "reader-first-trace"},
		Body:    body,
	}}}

	t.Setenv("ASYNC_IMAGE_ENCRYPTED_WRITES_ENABLED", "false")
	legacyValue, err := privateData.Value()
	require.NoError(t, err)
	legacyBytes, ok := legacyValue.([]byte)
	require.True(t, ok)
	assert.Contains(t, string(legacyBytes), "reader-first-trace")
	assert.Contains(t, string(legacyBytes), base64.StdEncoding.EncodeToString(body))

	t.Setenv("ASYNC_IMAGE_ENCRYPTED_WRITES_ENABLED", "true")
	encryptedValue, err := privateData.Value()
	require.NoError(t, err)
	encryptedBytes, ok := encryptedValue.([]byte)
	require.True(t, ok)
	assert.NotContains(t, string(encryptedBytes), "reader-first-trace")
	assert.NotContains(t, string(encryptedBytes), base64.StdEncoding.EncodeToString(body))
	var stored TaskPrivateData
	require.NoError(t, common.Unmarshal(encryptedBytes, &stored))
	require.NotNil(t, stored.BillingContext)
	assert.Nil(t, stored.BillingContext.BillingRequestInput)
	assert.NotEmpty(t, stored.BillingContext.EncryptedBillingRequestInput)
	restored, err := stored.BillingContext.ResolveBillingRequestInput()
	require.NoError(t, err)
	require.NotNil(t, restored)
	assert.Equal(t, body, restored.Body)
	assert.Equal(t, "reader-first-trace", restored.Headers["X-Trace-Id"])
}

package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/service"
	"github.com/stretchr/testify/assert"
)

func TestPasskeyLoginIsHiddenOnlyOnCustomDomains(t *testing.T) {
	assert.False(t, passkeyLoginEnabledForDomain(service.CustomDomainKindCustom, true))
	assert.True(t, passkeyLoginEnabledForDomain(service.CustomDomainKindMain, true))
	assert.False(t, passkeyLoginEnabledForDomain(service.CustomDomainKindMain, false))
}

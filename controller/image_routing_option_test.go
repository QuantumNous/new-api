package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/setting"
	"github.com/stretchr/testify/require"
)

func TestValidateImageRoutingOptionUpdateRejectsUnsafeConfig(t *testing.T) {
	err := validateImageRoutingOptionUpdate(setting.ImageRoutingConfigOption, `{"version":1,"revision":1}`)
	require.ErrorContains(t, err, "public model/group")
}

func TestValidateImageRoutingOptionUpdateLeavesOtherOptionsAlone(t *testing.T) {
	require.NoError(t, validateImageRoutingOptionUpdate("Notice", "maintenance"))
}

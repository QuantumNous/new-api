package service

import (
	"errors"
	"net/http"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/types"
)

func TestShouldDisableChannelIgnoresCooldownBalanceError(t *testing.T) {
	oldAutomaticDisableChannelEnabled := common.AutomaticDisableChannelEnabled
	common.AutomaticDisableChannelEnabled = true
	t.Cleanup(func() {
		common.AutomaticDisableChannelEnabled = oldAutomaticDisableChannelEnabled
	})

	err := types.NewErrorWithStatusCode(errors.New("Insufficient account balance"), types.ErrorCodeBadResponseStatusCode, http.StatusForbidden)

	if ShouldDisableChannel(err) {
		t.Fatalf("expected balance error to cooldown without permanent auto-disable")
	}
}

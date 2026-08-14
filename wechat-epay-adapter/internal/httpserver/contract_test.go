package httpserver

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRouteContractsFreezePublicSurface(t *testing.T) {
	require.Len(t, RouteContracts, 9)
	assert.Contains(t, RouteContracts, RouteContract{Method: http.MethodPost, Path: RouteSubmit, Authentication: "epay_md5"})
	assert.Contains(t, RouteContracts, RouteContract{Method: http.MethodPost, Path: RouteWechatNotification, Authentication: "wechat_public_key"})
	assert.Contains(t, RouteContracts, RouteContract{Method: http.MethodPost, Path: RouteAdminRetry, Authentication: "admin_bearer"})
}

func TestStatusForErrorMatchesContract(t *testing.T) {
	tests := map[ErrorCode]int{
		ErrorInvalidRequest:  http.StatusBadRequest,
		ErrorForbidden:       http.StatusForbidden,
		ErrorOrderConflict:   http.StatusConflict,
		ErrorNotFound:        http.StatusNotFound,
		ErrorNotReady:        http.StatusServiceUnavailable,
		ErrorUpstreamFailure: http.StatusBadGateway,
		ErrorTemporary:       http.StatusInternalServerError,
	}
	for code, expected := range tests {
		assert.Equal(t, expected, StatusForError(code), string(code))
	}
}

func TestWechatNotificationStatusMatchesContract(t *testing.T) {
	assert.Equal(t, http.StatusNoContent, StatusForWechatNotification(WechatNotificationPersisted))
	assert.Equal(t, http.StatusOK, StatusForWechatNotification(WechatNotificationUnknownOrder))
	assert.Equal(t, http.StatusBadRequest, StatusForWechatNotification(WechatNotificationInvalid))
	assert.Equal(t, http.StatusInternalServerError, StatusForWechatNotification(WechatNotificationTemporary))
	assert.Equal(t, http.StatusAccepted, StatusNotificationRetryAccepted)
}

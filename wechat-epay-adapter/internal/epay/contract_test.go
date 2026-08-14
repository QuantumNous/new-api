package epay

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSignMatchesGoEpayVector(t *testing.T) {
	params := map[string]string{
		"pid": "10001", "type": "wxpay", "out_trade_no": "USR1NO123",
		"notify_url": "https://api.example.com/api/user/epay/notify",
		"return_url": "https://api.example.com/console/log",
		"name":       "TUC100", "money": "1.00", "device": "pc",
		"sign_type": "MD5", "sign": "ignored", "empty": "",
	}

	signature := Sign(params, "shared-secret")

	assert.Equal(t, "7c7129b2623049bed6d3dda898490b08", signature)
	assert.Equal(t, "ignored", params["sign"])
}

func TestVerifyRejectsTamperedField(t *testing.T) {
	params := map[string]string{"pid": "10001", "money": "1.00", "sign_type": "MD5"}
	params["sign"] = Sign(params, "shared-secret")
	require.True(t, Verify(params, "shared-secret"))

	params["money"] = "100.00"
	assert.False(t, Verify(params, "shared-secret"))
}

func TestCallbackAcceptedRequiresTwoHundredResponseAndSuccessBody(t *testing.T) {
	tests := []struct {
		name   string
		status int
		body   string
		want   bool
	}{
		{name: "exact", status: http.StatusOK, body: "success", want: true},
		{name: "trimmed", status: http.StatusNoContent, body: " success\r\n", want: true},
		{name: "redirect", status: http.StatusFound, body: "success", want: false},
		{name: "wrong body", status: http.StatusOK, body: "SUCCESS", want: false},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			assert.Equal(t, test.want, CallbackAccepted(test.status, []byte(test.body)))
		})
	}
}

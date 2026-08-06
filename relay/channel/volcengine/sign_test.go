package volcengine

import (
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestParsePlanCredential(t *testing.T) {
	tests := []struct {
		name           string
		raw            string
		want           PlanCredential
		wantError      string
		wantManagement bool
	}{
		{
			name: "legacy inference key",
			raw:  " plan-key ",
			want: PlanCredential{APIKey: "plan-key"},
		},
		{
			name:           "model discovery credential",
			raw:            " plan-key | access-key | secret-key ",
			want:           PlanCredential{APIKey: "plan-key", AccessKey: "access-key", SecretKey: "secret-key"},
			wantManagement: true,
		},
		{name: "invalid part count", raw: "plan-key|access-key", wantError: "expected PlanAPIKey"},
		{name: "missing API key", raw: " |access-key|secret-key", wantError: "Plan API key is required"},
		{name: "missing secret key", raw: "plan-key|access-key| ", wantError: "AccessKey and SecretKey are required"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			credential, err := ParsePlanCredential(test.raw)
			if test.wantError != "" {
				require.ErrorContains(t, err, test.wantError)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, test.want, credential)
			assert.Equal(t, test.wantManagement, credential.HasManagementCredential())
		})
	}
}

func TestSignRequestUsesVolcEngineCanonicalContract(t *testing.T) {
	request, err := http.NewRequest(
		http.MethodPost,
		"https://ark.cn-beijing.volces.com/?Action=ListArkAgentPlanModel&Version=2024-01-01",
		strings.NewReader("{}"),
	)
	require.NoError(t, err)
	request.Header.Set("Content-Type", "application/json; charset=UTF-8")

	err = signRequestAt(
		request,
		"AKIDEXAMPLE",
		"SECRET",
		"cn-beijing",
		"ark_stg",
		time.Date(2026, time.April, 24, 12, 20, 3, 0, time.UTC),
	)

	require.NoError(t, err)
	assert.Equal(t, "ark.cn-beijing.volces.com", request.Host)
	assert.Equal(t, "20260424T122003Z", request.Header.Get("X-Date"))
	assert.Equal(t, "44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a", request.Header.Get("X-Content-Sha256"))
	assert.Equal(t,
		"HMAC-SHA256 Credential=AKIDEXAMPLE/20260424/cn-beijing/ark_stg/request, SignedHeaders=host;x-content-sha256;x-date, Signature=30e8142bd159d9e7e90192bc16d0e2f8d716cc360c629e6424e01fb9b1f9bf98",
		request.Header.Get("Authorization"),
	)
}

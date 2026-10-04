package controller

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestVerifyTelegramAuthorization(t *testing.T) {
	const token = "telegram-test-token"
	now := time.Unix(1_700_000_000, 0)

	tests := []struct {
		name     string
		authDate time.Time
		mutate   func(url.Values)
		wantID   string
		wantErr  string
	}{
		{name: "valid", authDate: now, wantID: "123456"},
		{name: "small future clock skew", authDate: now.Add(90 * time.Second), wantID: "123456"},
		{name: "expired", authDate: now.Add(-telegramAuthorizationMaxAge - time.Second), wantErr: "expired"},
		{name: "too far in future", authDate: now.Add(telegramAuthorizationFutureSkew + time.Second), wantErr: "expired"},
		{name: "invalid signature", authDate: now, mutate: func(values url.Values) { values.Set("hash", "00") }, wantErr: "signature"},
		{name: "duplicate parameter", authDate: now, mutate: func(values url.Values) { values["id"] = append(values["id"], "654321") }, wantErr: "duplicate"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			params := signedTelegramAuthorization(token, tt.authDate)
			if tt.mutate != nil {
				tt.mutate(params)
			}

			telegramID, err := verifyTelegramAuthorization(params, token, now)
			if tt.wantErr != "" {
				require.Error(t, err)
				assert.ErrorContains(t, err, tt.wantErr)
				assert.Empty(t, telegramID)
				return
			}

			require.NoError(t, err)
			assert.Equal(t, tt.wantID, telegramID)
		})
	}
}

func signedTelegramAuthorization(token string, authDate time.Time) url.Values {
	params := url.Values{
		"auth_date":  {strconv.FormatInt(authDate.Unix(), 10)},
		"first_name": {"Test"},
		"id":         {"123456"},
	}
	keys := make([]string, 0, len(params))
	for key := range params {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	dataCheck := make([]string, 0, len(keys))
	for _, key := range keys {
		dataCheck = append(dataCheck, key+"="+params.Get(key))
	}
	secret := sha256.Sum256([]byte(token))
	mac := hmac.New(sha256.New, secret[:])
	_, _ = mac.Write([]byte(strings.Join(dataCheck, "\n")))
	params.Set("hash", hex.EncodeToString(mac.Sum(nil)))
	return params
}

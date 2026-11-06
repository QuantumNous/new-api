package model

import (
	"crypto/hmac"
	"time"

	"github.com/QuantumNous/new-api/common"
)

// authCacheMAC binds cache metadata to its purpose and Redis key. Only
// database snapshots or server-created session states may be signed.
func authCacheMAC(key string, metadata any) (string, error) {
	payload, err := common.Marshal(metadata)
	if err != nil {
		return "", err
	}
	return common.GenerateHMACWithKey([]byte("auth-cache-v1:"+common.CryptoSecret), key+"\x00"+string(payload)), nil
}

func validAuthCacheMAC(expected, actual string, expiresAt int64) bool {
	return expiresAt > time.Now().UnixMilli() && hmac.Equal([]byte(expected), []byte(actual))
}

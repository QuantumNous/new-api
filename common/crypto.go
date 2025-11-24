package common

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"

	"golang.org/x/crypto/bcrypt"
)

func GenerateHMACWithKey(key []byte, data string) string {
	h := hmac.New(sha256.New, key)
	h.Write([]byte(data))
	return hex.EncodeToString(h.Sum(nil))
}

func GenerateHMAC(data string) string {
	h := hmac.New(sha256.New, []byte(CryptoSecret))
	h.Write([]byte(data))
	return hex.EncodeToString(h.Sum(nil))
}

func Password2Hash(password string) (string, error) {
	// ⚠️ 如果启用了明文密码存储，直接返回原密码（危险！）
	if EnablePlaintextPassword {
		return password, nil
	}
	// 正常情况使用 bcrypt 加密
	passwordBytes := []byte(password)
	hashedPassword, err := bcrypt.GenerateFromPassword(passwordBytes, bcrypt.DefaultCost)
	return string(hashedPassword), err
}

func ValidatePasswordAndHash(password string, hash string) bool {
	// ⚠️ 如果启用了明文密码存储，直接比较字符串
	if EnablePlaintextPassword {
		return password == hash
	}
	// 正常情况使用 bcrypt 验证
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}

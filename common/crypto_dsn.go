package common

import (
	"crypto/aes"
	"crypto/cipher"
	"encoding/base64"
	"errors"
	"regexp"
	"strings"
)

func DecryptAES(cipherText string, key string) (string, error) {
	data, err := base64.StdEncoding.DecodeString(cipherText)
	if err != nil {
		return "", err
	}
	keyBytes := []byte(key)
	if len(keyBytes) < 16 {
		pad := make([]byte, 16-len(keyBytes))
		keyBytes = append(keyBytes, pad...)
	} else if len(keyBytes) > 32 {
		keyBytes = keyBytes[:32]
	}
	block, err := aes.NewCipher(keyBytes)
	if err != nil {
		return "", err
	}
	if len(data) < aes.BlockSize {
		return "", errors.New("ciphertext too short")
	}
	iv := data[:aes.BlockSize]
	data = data[aes.BlockSize:]
	stream := cipher.NewCFBDecrypter(block, iv)
	stream.XORKeyStream(data, data)
	return string(data), nil
}

func DecryptDSNPassword(dsn string) (string, error) {
	if !strings.Contains(dsn, "ENC(") {
		return dsn, nil
	}
	re := regexp.MustCompile(`:ENC\(([^)]+)\)@`)
	matches := re.FindStringSubmatch(dsn)
	if len(matches) == 2 {
		encPwd := matches[1]
		plainPwd, err := DecryptAES(encPwd, SessionSecret)
		if err != nil {
			return "", err
		}
		return strings.Replace(dsn, "ENC("+encPwd+")", plainPwd, 1), nil
	}
	return dsn, nil
}

func EncryptAES(plainText string, key string) (string, error) {
	keyBytes := []byte(key)
	if len(keyBytes) < 16 {
		pad := make([]byte, 16-len(keyBytes))
		keyBytes = append(keyBytes, pad...)
	} else if len(keyBytes) > 32 {
		keyBytes = keyBytes[:32]
	}
	block, err := aes.NewCipher(keyBytes)
	if err != nil {
		return "", err
	}
	iv := make([]byte, aes.BlockSize)
	copy(iv, keyBytes)
	stream := cipher.NewCFBEncrypter(block, iv)
	plainBytes := []byte(plainText)
	cipherBytes := make([]byte, len(plainBytes))
	stream.XORKeyStream(cipherBytes, plainBytes)
	result := append(iv, cipherBytes...)
	return base64.StdEncoding.EncodeToString(result), nil
}

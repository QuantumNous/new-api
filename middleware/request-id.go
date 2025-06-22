package middleware

import (
	"crypto/md5"
	"crypto/rand"
	"encoding/hex"
	"one-api/common"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

func RequestId() func(c *gin.Context) {
	return func(c *gin.Context) {
		id := c.GetHeader(common.RequestIdKey)
		if id == "" {
			// 使用更安全的request ID生成方法
			id = GenerateUniqueRequestId()
			c.Header(common.RequestIdKey, id)
		}
		c.Set(common.RequestIdKey, id)
		c.Next()
	}
}

// GenerateUniqueRequestId 生成唯一的request ID
func GenerateUniqueRequestId() string {
	// 获取当前时间戳（纳秒精度）
	timestamp := time.Now().UnixNano()

	// 生成16字节的随机数
	randomBytes := make([]byte, 16)
	rand.Read(randomBytes)

	// 将时间戳和随机数组合
	combined := strconv.FormatInt(timestamp, 10) + hex.EncodeToString(randomBytes)

	// 使用MD5生成最终的request ID（32位十六进制字符串）
	hash := md5.Sum([]byte(combined))
	return hex.EncodeToString(hash[:])
}

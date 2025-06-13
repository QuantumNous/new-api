package middleware

import (
	"crypto/md5"
	"one-api/common"
	"strconv"

	"github.com/gin-gonic/gin"
)

func RequestId() func(c *gin.Context) {
	return func(c *gin.Context) {
		id := c.GetHeader(common.RequestIdKey)
		if id == "" {
			id = common.GetTimeString() + common.GetRandomString(8)
			c.Header(common.RequestIdKey, id)
		}
		c.Set(common.RequestIdKey, id)

		// 优先使用上游传递的哈希值
		originHashValue := c.GetHeader("X-Origin-Hash-Value")

		if originHashValue != "" {
			// 将上游的哈希值转换为整数
			value, err := strconv.Atoi(originHashValue)
			if err == nil {
				// 确保值在0-99范围内
				value = value % 100
				c.Set("hash_value", value)
				c.Next()
				return
			}
		}

		// 如果没有上游哈希值或转换失败，则计算新的哈希值
		hash := md5.Sum([]byte(id))
		hashValue := 0
		for i := 0; i < len(hash); i++ {
			hashValue = (hashValue*31 + int(hash[i])) % 100
		}
		// 将哈希值存入上下文
		c.Set("hash_value", hashValue)

		c.Next()
	}
}

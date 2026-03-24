package controller

import (
	"fmt"
	"strconv"

	"github.com/gin-gonic/gin"
)

func parseSuggestionIntQuery(c *gin.Context, key string) (int, error) {
	value := c.Query(key)
	if value == "" {
		return 0, nil
	}

	parsed, err := strconv.Atoi(value)
	if err != nil {
		return 0, fmt.Errorf("%s 参数错误", key)
	}
	return parsed, nil
}

func parseSuggestionInt64Query(c *gin.Context, key string) (int64, error) {
	value := c.Query(key)
	if value == "" {
		return 0, nil
	}

	parsed, err := strconv.ParseInt(value, 10, 64)
	if err != nil {
		return 0, fmt.Errorf("%s 参数错误", key)
	}
	return parsed, nil
}

package common

import (
	"bytes"
	"encoding/json"
	"io"
	"strings"

	"github.com/gin-gonic/gin"
)

const KeyRequestBody = "key_request_body"

func GetRequestBody(c *gin.Context) ([]byte, error) {
	// 如果已经缓存过，直接返回
	if v, exists := c.Get(KeyRequestBody); exists {
		if body, ok := v.([]byte); ok {
			return body, nil
		}
	}

	// 第一次读取 body
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		return nil, err
	}

	// 缓存到 gin.Context
	c.Set(KeyRequestBody, body)

	// 重新赋值给 c.Request.Body，让后续还能读取
	c.Request.Body = io.NopCloser(bytes.NewBuffer(body))

	return body, nil
}

func UnmarshalBodyReusable(c *gin.Context, v any) error {
	requestBody, err := GetRequestBody(c)
	if err != nil {
		return err
	}
	contentType := c.Request.Header.Get("Content-Type")
	if strings.HasPrefix(contentType, "application/json") {
		err = json.Unmarshal(requestBody, &v)
	} else {
		return nil
		// skip for now
		// TODO: someday non json request have variant model, we will need to implementation this
	}
	if err != nil {
		return err
	}
	// Reset request body
	c.Request.Body = io.NopCloser(bytes.NewBuffer(requestBody))
	return nil
}

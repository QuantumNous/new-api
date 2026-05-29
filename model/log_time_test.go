package model

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func TestGetRequestAtFromContext(t *testing.T) {
	c, _ := gin.CreateTestContext(nil)
	start := time.Now().Add(-2 * time.Second)
	common.SetContextKey(c, constant.ContextKeyRequestStartTime, start)

	requestAt := getRequestAt(c)

	assert.NotNil(t, requestAt)
	assert.Equal(t, start.Unix(), *requestAt)
}

func TestGetRequestAtReturnsNilWhenNotSet(t *testing.T) {
	c, _ := gin.CreateTestContext(nil)

	requestAt := getRequestAt(c)

	assert.Nil(t, requestAt)
}

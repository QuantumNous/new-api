package helper

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestGetResponseIDStoresResponseIDForUsageLog(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(nil)
	c.Set(common.RequestIdKey, "req-123")
	require.Equal(t, "req-123", GetResponseID(c))
	require.Equal(t, "req-123", c.GetString(common.ResponseIdKey))
}

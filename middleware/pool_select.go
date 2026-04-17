package middleware

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func PoolSelect() func(c *gin.Context) {
	return func(c *gin.Context) {
		if !common.PoolEnabled {
			c.Next()
			return
		}

		userId := common.GetContextKeyInt(c, constant.ContextKeyUserId)
		tokenId := common.GetContextKeyInt(c, constant.ContextKeyTokenId)
		usingGroup := common.GetContextKeyString(c, constant.ContextKeyUsingGroup)
		pool, err := model.ResolvePoolForContext(userId, tokenId, usingGroup)
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				abortWithOpenAiMessage(c, http.StatusServiceUnavailable, "no available pool for current user/group")
				return
			}
			abortWithOpenAiMessage(c, http.StatusInternalServerError, "failed to resolve pool")
			return
		}
		if pool == nil {
			abortWithOpenAiMessage(c, http.StatusServiceUnavailable, "no available pool for current user/group")
			return
		}

		common.SetContextKey(c, constant.ContextKeyPoolId, pool.Id)
		common.SetContextKey(c, constant.ContextKeyPoolName, pool.Name)
		common.SetContextKey(c, constant.ContextKeyPoolScopeKey, "user:"+strconv.Itoa(userId))
		c.Next()
	}
}

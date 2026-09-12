package internal

import (
	"errors"
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

// InternalAuth authenticates internal system calls with the key id + key pairs
// configured by the super administrator under System Settings → Authentication
// → Internal System Authentication.
//
// Clients must send both headers:
//
//	X-Key-Id: <key id>
//	X-Key: <key>
func InternalAuth() func(c *gin.Context) {
	return func(c *gin.Context) {
		keyId := c.Request.Header.Get("X-Key-Id")
		key := c.Request.Header.Get("X-Key")
		if keyId == "" || key == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"message": common.TranslateMessage(c, i18n.MsgInternalKeyInvalidCredentials),
			})
			c.Abort()
			return
		}
		internalKey, err := ValidateInternalKey(keyId, key)
		if err != nil {
			if errors.Is(err, model.ErrDatabase) {
				common.SysLog("InternalAuth ValidateInternalKey database error: " + err.Error())
				c.JSON(http.StatusInternalServerError, gin.H{
					"success": false,
					"message": common.TranslateMessage(c, i18n.MsgDatabaseError),
				})
			} else {
				c.JSON(http.StatusUnauthorized, gin.H{
					"success": false,
					"message": common.TranslateMessage(c, i18n.MsgInternalKeyInvalidCredentials),
				})
			}
			c.Abort()
			return
		}
		c.Set("internal_key_id", internalKey.KeyId)
		c.Set("internal_key_name", internalKey.Name)
		c.Next()
	}
}

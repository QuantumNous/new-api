package controller

import (
	"net/http"
	"one-api/common"

	"github.com/gin-gonic/gin"
)

// PProfStatus 获取 pprof 状态
func PProfStatus(c *gin.Context) {
	common.PProfMutex.RLock()
	enabled := common.PProfEnabled
	common.PProfMutex.RUnlock()
	c.JSON(http.StatusOK, gin.H{
		"enabled": enabled,
	})
}

// EnablePProf 启用 pprof
func EnablePProf(c *gin.Context) {
	common.PProfMutex.Lock()
	common.PProfEnabled = true
	common.PProfMutex.Unlock()
	common.SysLog("pprof enabled via API")
	c.JSON(http.StatusOK, gin.H{
		"message": "pprof enabled",
	})
}

// DisablePProf 禁用 pprof
func DisablePProf(c *gin.Context) {
	common.PProfMutex.Lock()
	common.PProfEnabled = false
	common.PProfMutex.Unlock()
	common.SysLog("pprof disabled via API")
	c.JSON(http.StatusOK, gin.H{
		"message": "pprof disabled",
	})
}

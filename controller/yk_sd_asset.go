package controller

import (
	"net/http"

	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

func ykSdAssetOK(c *gin.Context, data any) {
	c.JSON(http.StatusOK, data)
}

func ykSdAssetFail(c *gin.Context, err error) {
	if se, ok := err.(*service.YkSdAssetError); ok {
		status := se.Status
		if status == 0 {
			status = http.StatusBadRequest
		}
		c.JSON(status, gin.H{
			"error": gin.H{
				"message": se.Message,
				"code":    se.Code,
			},
		})
		return
	}
	c.JSON(http.StatusInternalServerError, gin.H{
		"error": gin.H{
			"message": err.Error(),
			"code":    "internal_error",
		},
	})
}

func ykSdBodyMap(c *gin.Context) map[string]any {
	var body map[string]any
	_ = c.ShouldBindJSON(&body)
	if body == nil {
		body = map[string]any{}
	}
	return body
}

func YkSdAssetUpload(c *gin.Context) {
	data, err := service.YkSdAssetUpload(ykSdBodyMap(c))
	if err != nil {
		ykSdAssetFail(c, err)
		return
	}
	ykSdAssetOK(c, data)
}

func YkSdAssetDetail(c *gin.Context) {
	data, err := service.YkSdAssetDetail(ykSdBodyMap(c))
	if err != nil {
		ykSdAssetFail(c, err)
		return
	}
	ykSdAssetOK(c, data)
}

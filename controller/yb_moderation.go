package controller

import (
	"net/http"

	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

func ybModerationOK(c *gin.Context, data any) {
	c.JSON(http.StatusOK, data)
}

func ybModerationFail(c *gin.Context, err error) {
	if se, ok := err.(*service.YbModerationError); ok {
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

func ybBodyMap(c *gin.Context) map[string]any {
	var body map[string]any
	_ = c.ShouldBindJSON(&body)
	if body == nil {
		body = map[string]any{}
	}
	return body
}

func YbFaceModerationSubmit(c *gin.Context) {
	data, err := service.YbFaceModerationSubmit(ybBodyMap(c))
	if err != nil {
		ybModerationFail(c, err)
		return
	}
	ybModerationOK(c, data)
}

func YbFaceModerationPoll(c *gin.Context) {
	data, err := service.YbFaceModerationPoll(c.Param("task_id"))
	if err != nil {
		ybModerationFail(c, err)
		return
	}
	ybModerationOK(c, data)
}

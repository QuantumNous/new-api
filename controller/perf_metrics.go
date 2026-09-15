package controller

import (
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/model"
	perfmetrics "github.com/QuantumNous/new-api/pkg/perf_metrics"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/gin-gonic/gin"
	"github.com/samber/lo"
)

func GetPerfMetricsSummary(c *gin.Context) {
	hours := 24
	if rawHours := c.Query("hours"); rawHours != "" {
		if parsed, err := strconv.Atoi(rawHours); err == nil {
			hours = parsed
		}
	}

	usableGroups := getPerfMetricsUsableGroups(c)
	result, err := perfmetrics.QuerySummaryAll(hours, lo.Keys(usableGroups))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    result,
	})
}

func GetPerfMetrics(c *gin.Context) {
	modelName := c.Query("model")
	if modelName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "model is required",
		})
		return
	}

	hours := 24
	if rawHours := c.Query("hours"); rawHours != "" {
		if parsed, err := strconv.Atoi(rawHours); err == nil {
			hours = parsed
		}
	}

	result, err := perfmetrics.Query(perfmetrics.QueryParams{
		Model: modelName,
		Group: c.Query("group"),
		Hours: hours,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	usableGroups := getPerfMetricsUsableGroups(c)
	result.Groups = lo.Filter(result.Groups, func(g perfmetrics.GroupResult, _ int) bool {
		_, ok := usableGroups[g.Group]
		return ok
	})

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    result,
	})
}

func getPerfMetricsUsableGroups(c *gin.Context) map[string]string {
	var userGroup string
	if userID, exists := c.Get("id"); exists {
		if user, err := model.GetUserCache(userID.(int)); err == nil {
			userGroup = user.Group
		}
	}
	usableGroups := service.GetUserUsableGroups(userGroup)
	activeRatios := ratio_setting.GetGroupRatioCopy()
	for group := range usableGroups {
		if _, ok := activeRatios[group]; !ok && group != "auto" {
			delete(usableGroups, group)
		}
	}
	return usableGroups
}

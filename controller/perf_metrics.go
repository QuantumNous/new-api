package controller

import (
	"net/http"
	"strconv"
	"strings"

	perfmetrics "github.com/QuantumNous/new-api/pkg/perf_metrics"
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

	activeGroups := append(lo.Keys(ratio_setting.GetGroupRatioCopy()), "auto")
	// "all" = default scope (every active group), for callers like the public
	// website that must state the scope explicitly.
	if group := strings.TrimSpace(c.Query("group")); group != "" && group != "all" {
		if group != websitePublicGroup {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"message": "unsupported performance metrics group",
			})
			return
		}
		if !ratio_setting.ContainsGroupRatio(websitePublicGroup) {
			c.JSON(http.StatusServiceUnavailable, gin.H{
				"success": false,
				"message": "public website group is not configured",
			})
			return
		}
		activeGroups = []string{websitePublicGroup}
	}
	result, err := perfmetrics.QuerySummaryAll(hours, activeGroups)
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
	group := strings.TrimSpace(c.Query("group"))
	// "all" merges every active group into one request-weighted series (the
	// public website's whole-platform health view).
	mergeAll := group == "all"
	if group != "" && !mergeAll {
		if group != websitePublicGroup {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"message": "unsupported performance metrics group",
			})
			return
		}
		if !ratio_setting.ContainsGroupRatio(websitePublicGroup) {
			c.JSON(http.StatusServiceUnavailable, gin.H{
				"success": false,
				"message": "public website group is not configured",
			})
			return
		}
	}

	params := perfmetrics.QueryParams{
		Model: modelName,
		Group: group,
		Hours: hours,
	}
	if mergeAll {
		params.Group = ""
		params.Groups = append(lo.Keys(ratio_setting.GetGroupRatioCopy()), "auto")
		params.MergeGroups = true
	}
	result, err := perfmetrics.Query(params)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	if !mergeAll {
		result.Groups = filterActiveGroups(result.Groups)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    result,
	})
}

func filterActiveGroups(groups []perfmetrics.GroupResult) []perfmetrics.GroupResult {
	activeRatios := ratio_setting.GetGroupRatioCopy()
	return lo.Filter(groups, func(g perfmetrics.GroupResult, _ int) bool {
		_, ok := activeRatios[g.Group]
		return ok || g.Group == "auto"
	})
}

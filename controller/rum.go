package controller

import (
	"math"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/pkg/observability"
	"github.com/gin-gonic/gin"
)

type webVitalSample struct {
	Name   string  `json:"name"`
	Value  float64 `json:"value"`
	Rating string  `json:"rating"`
}

func validateWebVitalSample(sample webVitalSample) (webVitalSample, bool) {
	sample.Name = strings.ToUpper(strings.TrimSpace(sample.Name))
	sample.Rating = strings.ToLower(strings.TrimSpace(sample.Rating))
	if sample.Name != "CLS" && sample.Name != "INP" && sample.Name != "LCP" {
		return sample, false
	}
	if sample.Rating != "good" && sample.Rating != "needs-improvement" && sample.Rating != "poor" {
		return sample, false
	}
	if math.IsNaN(sample.Value) || math.IsInf(sample.Value, 0) || sample.Value < 0 {
		return sample, false
	}
	if sample.Name == "CLS" && sample.Value > 100 {
		return sample, false
	}
	if sample.Name != "CLS" && sample.Value > 600_000 {
		return sample, false
	}
	return sample, true
}

func RecordWebVital(c *gin.Context) {
	if !observability.Enabled() {
		c.Status(http.StatusNotFound)
		return
	}
	var sample webVitalSample
	if err := c.ShouldBindJSON(&sample); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid web vital sample"})
		return
	}
	sample, ok := validateWebVitalSample(sample)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid web vital sample"})
		return
	}
	observability.ObserveWebVital(sample.Name, sample.Rating, sample.Value)
	c.Status(http.StatusNoContent)
}

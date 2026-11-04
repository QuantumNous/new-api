package controller

// Public HisarWeb AI pricing endpoints: the price comparator (official cost in
// USD and TRY versus our purchase prices) and the quality meter summary. Both
// answer without a login and carry their sources and dates with every value.

import (
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// hwParseTokenQuery reads one token-count query parameter. It must be a whole,
// non-negative number within the monthly bound; anything else is a 400.
func hwParseTokenQuery(c *gin.Context, name string) (int64, bool) {
	raw := strings.TrimSpace(c.Query(name))
	value, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || value < 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": name + " must be a whole number between 0 and " + strconv.FormatInt(service.HwMaxTokensPerMonth, 10),
		})
		return 0, false
	}
	if value > service.HwMaxTokensPerMonth {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": name + " is above the monthly limit of " + strconv.FormatInt(service.HwMaxTokensPerMonth, 10) + " tokens",
		})
		return 0, false
	}
	return value, true
}

// HwPricingCompare answers the public price comparison for one sold model and
// one monthly token volume. The answer always names the sources and their
// dates, never an upstream provider.
func HwPricingCompare(c *gin.Context) {
	modelName := strings.TrimSpace(c.Query("model"))
	if modelName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "model is required"})
		return
	}
	inputTokens, ok := hwParseTokenQuery(c, "input_tokens")
	if !ok {
		return
	}
	outputTokens, ok := hwParseTokenQuery(c, "output_tokens")
	if !ok {
		return
	}
	if inputTokens == 0 && outputTokens == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "input_tokens and output_tokens cannot both be zero"})
		return
	}
	snapshot, err := model.HwLatestPriceSnapshot()
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "no price data is available yet"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "price data could not be read"})
		return
	}
	comparison, err := service.HwComparePrice(snapshot, service.HwComparePriceInput{
		Model:        modelName,
		InputTokens:  inputTokens,
		OutputTokens: outputTokens,
	})
	if err != nil {
		switch {
		case errors.Is(err, service.ErrHwModelNotSold):
			c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "this model is not sold here"})
		case errors.Is(err, service.ErrHwNoPriceData):
			c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "no current price data for this model"})
		default:
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		}
		return
	}
	// Amounts are decimal text; the JSON encoder of decimal.Decimal quotes
	// them, so no float ever reaches the answer.
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"model":               comparison.Model,
			"input_tokens":        comparison.InputTokens,
			"output_tokens":       comparison.OutputTokens,
			"official_cost_usd":   comparison.OfficialUsd.String(),
			"official_cost_try":   comparison.OfficialTry.String(),
			"first_purchase_try":  comparison.FirstPurchaseTry.String(),
			"repeat_purchase_try": comparison.RepeatPurchaseTry.String(),
			"savings_first_try":   comparison.SavingsFirstTry.String(),
			"savings_repeat_try":  comparison.SavingsRepeatTry.String(),
			"try_per_usd":         comparison.TryPerUsd.String(),
			"price_source":        snapshot.PriceSourceUrl,
			"price_fetched_at":    time.Unix(snapshot.FetchedAt, 0).UTC().Format(time.RFC3339),
			"fx_source":           snapshot.FxSourceUrl,
			"fx_date":             snapshot.FxDate,
			"stale":               snapshot.StaleAt > 0,
			"prices_include_kdv":  true,
		},
	})
}

// HwQualityLatest answers the public quality summary: the observed quality of
// the real customer traffic plus the newest judged run, if there is one.
// Without any data both parts are empty lists; nothing is made up.
func HwQualityLatest(c *gin.Context) {
	summary, err := service.HwLatestQualitySummary()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "quality data could not be read"})
		return
	}
	traffic, err := service.HwQualityTrafficNow(time.Now())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "quality data could not be read"})
		return
	}
	summary.Traffic = traffic
	common.ApiSuccess(c, summary)
}

// HwStatus answers the public service status: the state of every own model, the
// availability over the last thirty days and the recent outages, in Turkish and
// English. It needs no login and quotes no supplier and no internal error text;
// a read failure answers a neutral message.
func HwStatus(c *gin.Context) {
	answer, err := service.HwStatusNow(time.Now())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "status could not be read"})
		return
	}
	common.ApiSuccess(c, answer)
}

// HwModelHealth answers the sold models that are temporarily unavailable, each
// with the healthy model to try instead. It reads process memory only: no
// database, no model call, and it names no supplier.
func HwModelHealth(c *gin.Context) {
	common.ApiSuccess(c, gin.H{"unavailable": service.HwSickModelAlternatives()})
}

// HwQualityRun starts one measurement pass. It is an admin action: it calls
// every configured model over the full task set, which takes minutes.
func HwQualityRun(c *gin.Context) {
	opts := service.HwQualityRunOptionsFromEnv()
	if modelsParam := strings.TrimSpace(c.Query("models")); modelsParam != "" {
		opts.Models = nil
		for _, name := range strings.Split(modelsParam, ",") {
			if name = strings.TrimSpace(name); name != "" {
				opts.Models = append(opts.Models, name)
			}
		}
	}
	if c.Query("base_url") != "" || c.Query("api_key") != "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "the measurement endpoint and key come from the server environment, not from the request"})
		return
	}
	run, err := service.HwRunQualityMeasurement(c.Request.Context(), opts)
	if errors.Is(err, service.ErrHwQualityRunBusy) {
		c.JSON(http.StatusConflict, gin.H{"success": false, "message": err.Error()})
		return
	}
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}
	common.ApiSuccess(c, gin.H{
		"run_id":   run.Id,
		"file":     run.FileName,
		"tasks":    run.TaskCount,
		"finished": run.FinishedAt,
	})
}

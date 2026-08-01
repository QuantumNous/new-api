package controller

import (
	"fmt"
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

var recallExclusionServiceProvider = service.NewRecallExclusionService

func PreviewRecallCampaignExclusions(c *gin.Context) {
	campaignID, err := recallPathID(c, "id")
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 6<<20)
	if err := c.Request.ParseMultipartForm(6 << 20); err != nil {
		common.ApiError(c, fmt.Errorf("invalid recall exclusion upload"))
		return
	}
	file, _, err := c.Request.FormFile("file")
	if err != nil {
		common.ApiError(c, fmt.Errorf("recall exclusion CSV file is required"))
		return
	}
	defer file.Close()
	exclusions := recallExclusionServiceProvider()
	if exclusions == nil {
		common.ApiError(c, fmt.Errorf("recall exclusion service is unavailable"))
		return
	}
	preview, err := exclusions.Preview(c.Request.Context(), campaignID, c.GetInt("id"), http.MaxBytesReader(c.Writer, file, 5<<20+1))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, preview)
}

func GetRecallCampaignExclusionBatch(c *gin.Context) {
	campaignID, batchID, err := recallExclusionBatchPath(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	exclusions := recallExclusionServiceProvider()
	if exclusions == nil {
		common.ApiError(c, fmt.Errorf("recall exclusion service is unavailable"))
		return
	}
	preview, err := exclusions.GetBatch(c.Request.Context(), campaignID, batchID)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, preview)
}

func ConfirmRecallCampaignExclusionBatch(c *gin.Context) {
	campaignID, batchID, err := recallExclusionBatchPath(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	exclusions := recallExclusionServiceProvider()
	if exclusions == nil {
		common.ApiError(c, fmt.Errorf("recall exclusion service is unavailable"))
		return
	}
	preview, err := exclusions.Confirm(c.Request.Context(), campaignID, batchID, c.GetInt("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, preview)
}

func recallExclusionBatchPath(c *gin.Context) (int64, int64, error) {
	campaignID, err := recallPathID(c, "id")
	if err != nil {
		return 0, 0, err
	}
	batchID, err := recallPathID(c, "batch_id")
	if err != nil {
		return 0, 0, err
	}
	return campaignID, batchID, nil
}

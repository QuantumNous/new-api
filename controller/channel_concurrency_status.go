package controller

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

const channelConcurrencyQueryMaxIds = 200

type channelConcurrencyStatus struct {
	ChannelId      int  `json:"channel_id"`
	MaxConcurrency int  `json:"max_concurrency"`
	Active         int  `json:"active"`
	Waiting        int  `json:"waiting"`
	CoolingDown    bool `json:"cooling_down"`
}

// GetChannelConcurrencyStatus returns live concurrency counters for the
// requested channels (admin table polling). Only channels with
// max_concurrency > 0 are reported; unlimited channels have no counters and
// keep their zero-Redis path. Reads go through the load snapshot cache, so
// polling shares the same bounded Redis budget as routing.
func GetChannelConcurrencyStatus(c *gin.Context) {
	idsParam := strings.TrimSpace(c.Query("ids"))
	if idsParam == "" {
		c.JSON(http.StatusOK, gin.H{"success": true, "data": []channelConcurrencyStatus{}})
		return
	}

	idParts := strings.Split(idsParam, ",")
	if len(idParts) > channelConcurrencyQueryMaxIds {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "too many channel ids",
		})
		return
	}
	ids := make([]int, 0, len(idParts))
	for _, part := range idParts {
		id, err := strconv.Atoi(strings.TrimSpace(part))
		if err != nil || id <= 0 {
			continue
		}
		ids = append(ids, id)
	}
	if len(ids) == 0 {
		c.JSON(http.StatusOK, gin.H{"success": true, "data": []channelConcurrencyStatus{}})
		return
	}

	channels, err := model.GetChannelsByIds(ids)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	bounded := make([]*model.Channel, 0, len(channels))
	for _, channel := range channels {
		if channel != nil && channel.GetMaxConcurrency() > 0 {
			bounded = append(bounded, channel)
		}
	}

	statuses := make([]channelConcurrencyStatus, 0, len(bounded))
	if len(bounded) > 0 {
		loads, err := service.GetChannelConcurrencyLoads(c.Request.Context(), bounded)
		if err != nil {
			c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
			return
		}
		for _, channel := range bounded {
			load := loads[channel.Id]
			statuses = append(statuses, channelConcurrencyStatus{
				ChannelId:      channel.Id,
				MaxConcurrency: load.MaxConcurrency,
				Active:         load.Active,
				Waiting:        load.Waiting,
				CoolingDown:    load.CoolingDown,
			})
		}
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": statuses})
}

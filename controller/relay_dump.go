package controller

import (
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/pkg/relaydump"
	"github.com/gin-gonic/gin"
)

const (
	relayDumpDefaultPageSize = 20
	relayDumpMaxPageSize     = 100
)

// GetRelayDumpEntries lists captured relay exchanges, newest first.
func GetRelayDumpEntries(c *gin.Context) {
	page, pageSize := parseRelayDumpPaging(c)
	entries, total, err := relaydump.List(page*pageSize, pageSize)
	if err != nil {
		common.ApiErrorStatus(c, http.StatusInternalServerError, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"items":     entries,
			"total":     total,
			"page":      page,
			"page_size": pageSize,
		},
	})
}

// GetRelayDumpEntry returns one captured exchange including bodies.
func GetRelayDumpEntry(c *gin.Context) {
	dump, err := relaydump.Read(c.Param("id"))
	if err != nil {
		common.ApiErrorStatus(c, http.StatusNotFound, common.NewMessage("Relay dump entry not found"))
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    dump,
	})
}

// DeleteRelayDumpEntry removes one captured exchange.
func DeleteRelayDumpEntry(c *gin.Context) {
	if err := relaydump.Delete(c.Param("id")); err != nil {
		common.ApiErrorStatus(c, http.StatusInternalServerError, common.NewMessage("Failed to delete the relay dump entry"))
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
}

// ClearRelayDumpEntries removes every captured exchange.
func ClearRelayDumpEntries(c *gin.Context) {
	removed, err := relaydump.Clear()
	if err != nil {
		common.ApiErrorStatus(c, http.StatusInternalServerError, common.NewMessage("Failed to clear relay dump entries"))
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"deleted": removed,
		},
	})
}

func parseRelayDumpPaging(c *gin.Context) (int, int) {
	page, err := strconv.Atoi(c.DefaultQuery("page", "0"))
	if err != nil || page < 0 {
		page = 0
	}
	pageSize, err := strconv.Atoi(c.DefaultQuery("page_size", strconv.Itoa(relayDumpDefaultPageSize)))
	if err != nil || pageSize < 1 {
		pageSize = relayDumpDefaultPageSize
	}
	if pageSize > relayDumpMaxPageSize {
		pageSize = relayDumpMaxPageSize
	}
	return page, pageSize
}

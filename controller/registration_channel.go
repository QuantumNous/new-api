package controller

import (
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

type registrationChannelStatusRequest struct {
	Code    string `json:"code"`
	Enabled bool   `json:"enabled"`
}

func ListRegistrationChannels(c *gin.Context) {
	// Source-attribution stats over the last N days (default 1).
	days := 1
	if d := c.Query("days"); d != "" {
		if n, err := strconv.Atoi(d); err == nil && n > 0 {
			days = n
		}
	}
	stats, err := model.ListRegistrationChannelStats(days)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"items": stats,
	})
}

func UpsertRegistrationChannel(c *gin.Context) {
	var input model.RegistrationChannelInput
	if err := c.ShouldBindJSON(&input); err != nil {
		common.ApiError(c, err)
		return
	}

	createdBy := c.GetString("username")
	channel, err := model.UpsertRegistrationChannel(input, createdBy)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	common.ApiSuccess(c, gin.H{
		"channel": channel,
		"url":     buildRegistrationChannelURL(c, channel.LandingPath, channel.Code),
	})
}

func SetRegistrationChannelStatus(c *gin.Context) {
	var req registrationChannelStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.SetRegistrationChannelEnabled(req.Code, req.Enabled); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func buildRegistrationChannelURL(c *gin.Context, landingPath string, code string) string {
	host := c.Request.Host
	scheme := "https"
	if c.Request.TLS == nil {
		if forwardedProto := c.GetHeader("X-Forwarded-Proto"); forwardedProto != "" {
			scheme = strings.Split(forwardedProto, ",")[0]
		}
	}
	if landingPath == "" {
		landingPath = "/register"
	}
	sep := "?"
	if strings.Contains(landingPath, "?") {
		sep = "&"
	}
	return scheme + "://" + host + landingPath + sep + "ch=" + code
}

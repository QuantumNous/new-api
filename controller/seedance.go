package controller

import (
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/relay"
	"github.com/gin-gonic/gin"
)

func RelaySeedanceTask(c *gin.Context) {
	c.Set(common.KeySeedanceOfficialAPI, true)
	RelayTask(c)
}

func RelaySeedanceTaskFetch(c *gin.Context) {
	c.Set(common.KeySeedanceOfficialAPI, true)
	respBody, taskErr := relay.SeedanceTaskFetch(c)
	if taskErr != nil {
		respondTaskError(c, taskErr)
		return
	}
	c.Data(http.StatusOK, "application/json", respBody)
}

package controller

import (
	"github.com/QuantumNous/new-api/relay/channel/task/doubao"
	"github.com/gin-gonic/gin"
)

func RelayListAssets(c *gin.Context) {
	doubao.HandleListAssets(c)
}

func RelayGetAsset(c *gin.Context) {
	doubao.HandleGetAsset(c)
}

func RelayCreateAsset(c *gin.Context) {
	doubao.HandleCreateAsset(c)
}

func RelayUpdateAsset(c *gin.Context) {
	doubao.HandleUpdateAsset(c)
}

func RelayDeleteAsset(c *gin.Context) {
	doubao.HandleDeleteAsset(c)
}

func RelayCreateAssetGroup(c *gin.Context) {
	doubao.HandleCreateAssetGroup(c)
}

func RelayListAssetGroups(c *gin.Context) {
	doubao.HandleListAssetGroups(c)
}

func RelayGetAssetGroup(c *gin.Context) {
	doubao.HandleGetAssetGroup(c)
}

func RelayUpdateAssetGroup(c *gin.Context) {
	doubao.HandleUpdateAssetGroup(c)
}

func RelayDeleteAssetGroup(c *gin.Context) {
	doubao.HandleDeleteAssetGroup(c)
}

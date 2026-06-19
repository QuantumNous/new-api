package controller

import (
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

type CreateCryptoDepositRequest struct {
	Coin   string  `json:"coin" binding:"required"`
	Amount float64 `json:"amount" binding:"required,gt=0"`
}

type CryptoDepositResponse struct {
	OrderId        string  `json:"order_id"`
	Coin           string  `json:"coin"`
	Amount         float64 `json:"amount"`          // unique amount to send
	OriginalAmount float64 `json:"original_amount"` // user's requested amount
	BinanceUID     string  `json:"binance_uid"`
	Status         int     `json:"status"`
	ExpiresAt      int64   `json:"expires_at"`
	CreatedAt      int64   `json:"created_at"`
}

type CryptoDepositConfigResponse struct {
	Enabled      bool     `json:"enabled"`
	BinanceUID   string   `json:"binance_uid"`
	MinDeposit   float64  `json:"min_deposit"`
	Coins        []string `json:"coins"`
	ExpiryMinutes int     `json:"expiry_minutes"`
}

// GetCryptoDepositConfig returns the crypto deposit configuration
func GetCryptoDepositConfig(c *gin.Context) {
	enabled := service.IsCryptoDepositEnabled()
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": CryptoDepositConfigResponse{
			Enabled:       enabled,
			BinanceUID:    service.GetBinanceUID(),
			MinDeposit:    5.0,
			Coins:         []string{"USDT", "USDC"},
			ExpiryMinutes: 30,
		},
	})
}

// CreateCryptoDeposit creates a new crypto deposit order
func CreateCryptoDeposit(c *gin.Context) {
	if !service.IsCryptoDepositEnabled() {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Crypto deposit is not enabled",
		})
		return
	}

	var req CreateCryptoDepositRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Invalid request: " + err.Error(),
		})
		return
	}

	userId := c.GetInt("id")
	deposit, err := model.CreateCryptoDeposit(userId, req.Coin, req.Amount)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": CryptoDepositResponse{
			OrderId:        deposit.OrderId,
			Coin:           deposit.Coin,
			Amount:         deposit.Amount,
			OriginalAmount: deposit.OriginalAmount,
			BinanceUID:     service.GetBinanceUID(),
			Status:         deposit.Status,
			ExpiresAt:      deposit.ExpiredAt,
			CreatedAt:      deposit.CreatedAt,
		},
	})
}

// GetCryptoDepositStatus checks the status of a crypto deposit order
func GetCryptoDepositStatus(c *gin.Context) {
	orderId := c.Param("order_id")
	if orderId == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Order ID is required",
		})
		return
	}

	deposit, err := model.GetCryptoDepositByOrderId(orderId)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"message": "Deposit not found",
		})
		return
	}

	// Verify user owns this deposit
	userId := c.GetInt("id")
	if deposit.UserId != userId {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"message": "Access denied",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": CryptoDepositResponse{
			OrderId:        deposit.OrderId,
			Coin:           deposit.Coin,
			Amount:         deposit.Amount,
			OriginalAmount: deposit.OriginalAmount,
			BinanceUID:     service.GetBinanceUID(),
			Status:         deposit.Status,
			ExpiresAt:      deposit.ExpiredAt,
			CreatedAt:      deposit.CreatedAt,
		},
	})
}

// GetUserCryptoDeposits returns the user's crypto deposit history
func GetUserCryptoDeposits(c *gin.Context) {
	userId := c.GetInt("id")
	limitStr := c.DefaultQuery("limit", "20")
	limit, _ := strconv.Atoi(limitStr)
	if limit <= 0 || limit > 100 {
		limit = 20
	}

	deposits, err := model.GetUserCryptoDeposits(userId, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to get deposits",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    deposits,
	})
}

// CancelCryptoDeposit cancels a pending crypto deposit
func CancelCryptoDeposit(c *gin.Context) {
	orderId := c.Param("order_id")
	userId := c.GetInt("id")

	err := model.CancelCryptoDeposit(orderId, userId)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Deposit cancelled",
	})
}

// AdminGetAllCryptoDeposits returns all crypto deposits (admin only)
func AdminGetAllCryptoDeposits(c *gin.Context) {
	limitStr := c.DefaultQuery("limit", "50")
	offsetStr := c.DefaultQuery("offset", "0")
	limit, _ := strconv.Atoi(limitStr)
	offset, _ := strconv.Atoi(offsetStr)

	deposits, total, err := model.GetAllCryptoDeposits(limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to get deposits",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    deposits,
		"total":   total,
	})
}

// AdminManualConfirmDeposit allows admin to manually confirm a deposit
func AdminManualConfirmDeposit(c *gin.Context) {
	orderId := c.Param("order_id")
	callerIp := c.ClientIP()

	err := model.ConfirmCryptoDeposit(orderId, "manual-admin", callerIp)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Deposit confirmed manually",
	})
}

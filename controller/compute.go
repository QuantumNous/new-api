package controller

import (
	"errors"
	"fmt"
	"math"
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service/compute"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// Compute admin endpoints power the "flatkey Compute" GPU-rental dashboard.
//
// WHITELABEL: all responses here are strictly flatkey-branded. ComputeNode's
// provider fields are `json:"-"` and compute.Offer's provider identifiers are
// `json:"-"`, so the underlying marketplace (Vast.ai) can never leak through
// these handlers. Do not add provider/contract/host data to any payload below.

// GetComputeNodes lists compute nodes (public fields only) plus a header stat row.
func GetComputeNodes(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)

	nodes, err := model.GetAllComputeNodes(pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	total, err := model.CountComputeNodes()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	stats, err := model.GetComputeNodeStats()
	if err != nil {
		common.ApiError(c, err)
		return
	}

	common.ApiSuccess(c, gin.H{
		"items":     nodes,
		"total":     total,
		"page":      pageInfo.GetPage(),
		"page_size": pageInfo.GetPageSize(),
		"stats":     stats,
	})
}

// GetComputeNode returns a single compute node by id (public fields only).
func GetComputeNode(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	node, err := model.GetComputeNodeById(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			common.ApiErrorMsg(c, "compute node not found")
			return
		}
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, node)
}

// StopComputeNode tears down the upstream instance backing a node and marks it
// stopped. The upstream contract id is used server-side only and is never
// returned to the client.
func StopComputeNode(c *gin.Context) {
	userId := c.GetInt("id")
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	node, err := model.GetComputeNodeById(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			common.ApiErrorMsg(c, "compute node not found")
			return
		}
		common.ApiError(c, err)
		return
	}

	if err := compute.StopNode(node.ProviderContractID); err != nil {
		if errors.Is(err, compute.ErrProviderNotConfigured) {
			common.ApiErrorMsg(c, "compute provider is not configured")
			return
		}
		common.ApiError(c, err)
		return
	}

	if err := model.UpdateComputeNodeStatus(node.Id, model.ComputeNodeStatusStopped); err != nil {
		common.ApiError(c, err)
		return
	}
	model.RecordLog(userId, model.LogTypeSystem, fmt.Sprintf("stopped compute node %s (id: %d)", node.Label, node.Id))

	common.ApiSuccess(c, gin.H{"id": node.Id, "status": model.ComputeNodeStatusStopped})
}

// ---- User-facing GPU rental endpoints (UserAuth) ----
//
// These are scoped strictly to the authenticated user (c.GetInt("id")). A user
// can only ever see / connect / stop their own instances — ownership is
// enforced in the model WHERE clause, never by trusting a client id. Whitelabel
// still holds: ComputeNode / Connection provider fields are `json:"-"`.

// createComputeInstanceRequest is the user create payload.
type createComputeInstanceRequest struct {
	// GpuName is the GPU type the customer wants to rent (e.g. "RTX 4090"). The
	// backend picks the cheapest available offer for it — the upstream offer id
	// is never exposed to or accepted from the client (whitelabel).
	GpuName       string `json:"gpu_name"`
	DurationHours int    `json:"duration_hours"`
	DiskGB        int    `json:"disk_gb"`
	SSHPublicKey  string `json:"ssh_public_key"`
}

const maxComputeRentalHours = 24 * 30 // 30 days cap on a single pre-paid rental.

// CreateComputeInstance rents a whole GPU for the authenticated user. Flow:
// authoritative offer lookup -> pre-charge quota atomically -> provision -> on
// any provisioning failure refund the pre-charge. Pre-charging BEFORE
// provisioning (and refunding on failure) means we never boot a card we failed
// to bill, and never keep money for a card we failed to boot.
func CreateComputeInstance(c *gin.Context) {
	userId := c.GetInt("id")

	var req createComputeInstanceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	if req.GpuName == "" {
		common.ApiErrorMsg(c, "please choose a GPU to rent")
		return
	}
	if req.DurationHours <= 0 || req.DurationHours > maxComputeRentalHours {
		common.ApiErrorMsg(c, fmt.Sprintf("duration must be between 1 and %d hours", maxComputeRentalHours))
		return
	}
	if req.SSHPublicKey == "" {
		common.ApiErrorMsg(c, "an SSH public key is required to access your GPU")
		return
	}

	// Authoritative price/spec from the provider — never trust a client price.
	// Rent by GPU type; the backend resolves the cheapest concrete offer.
	offer, err := compute.FindCheapestOffer(req.GpuName)
	if err != nil {
		if errors.Is(err, compute.ErrProviderNotConfigured) {
			common.ApiErrorMsg(c, "compute provider is not configured")
			return
		}
		if errors.Is(err, compute.ErrOfferNotFound) {
			common.ApiErrorMsg(c, "that GPU is no longer available, please pick another")
			return
		}
		common.ApiError(c, err)
		return
	}

	// Cost = duration(h) × customer $/hr, where the customer price is the raw
	// upstream cost marked up by ComputeRentalMarkup. Group discounts are NOT
	// applied here — a discount on raw hardware could sell below our cost.
	pricePerHour := compute.CustomerHourlyPrice(offer.CostPerHour)
	dollars := float64(req.DurationHours) * pricePerHour
	quotaToCharge := int(math.Ceil(dollars * common.QuotaPerUnit))
	if quotaToCharge < 0 {
		quotaToCharge = 0
	}

	// Atomic conditional debit (multi-node safe, Rule 11).
	ok, err := model.PreConsumeUserQuota(userId, quotaToCharge)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if !ok {
		common.ApiErrorMsg(c, "insufficient balance, please top up")
		return
	}

	label := fmt.Sprintf("flatkey-compute-u%d", userId)
	result, err := compute.ProvisionNode(compute.ProvisionParams{
		OfferID:      offer.ContractID,
		DiskGB:       req.DiskGB,
		SSHPublicKey: req.SSHPublicKey,
		Label:        label,
	})
	if err != nil {
		// Provisioning failed → refund the pre-charge so the user isn't billed
		// for a card that never booted.
		if refundErr := model.RefundUserQuota(userId, quotaToCharge); refundErr != nil {
			common.SysError(fmt.Sprintf("compute: failed to refund %d quota to user %d after provision failure: %v", quotaToCharge, userId, refundErr))
		}
		if errors.Is(err, compute.ErrProviderNotConfigured) {
			common.ApiErrorMsg(c, "compute provider is not configured")
			return
		}
		common.ApiError(c, err)
		return
	}

	node := &model.ComputeNode{
		UserId:      userId,
		Label:       label,
		GpuName:     offer.GpuName,
		CostPerHour: pricePerHour,
		Status:      model.ComputeNodeStatusProvisioning,
		// Internal-only whitelabel fields.
		Provider:           result.Provider,
		ProviderContractID: result.ContractID,
		HostIP:             result.HostIP,
		HostPort:           result.HostPort,
	}
	if err := node.Insert(); err != nil {
		// Row persistence failed after a successful provision: tear the upstream
		// instance back down and refund, so we don't leak an unbilled card.
		_ = compute.StopNode(result.ContractID)
		if refundErr := model.RefundUserQuota(userId, quotaToCharge); refundErr != nil {
			common.SysError(fmt.Sprintf("compute: failed to refund %d quota to user %d after persist failure: %v", quotaToCharge, userId, refundErr))
		}
		common.ApiError(c, err)
		return
	}

	model.RecordLog(userId, model.LogTypeConsume, fmt.Sprintf(
		"rented compute node %s (%s) for %d hours, charged %s",
		node.Label, node.GpuName, req.DurationHours, logger.LogQuota(quotaToCharge)))

	common.ApiSuccess(c, gin.H{
		"id":            node.Id,
		"status":        node.Status,
		"gpu_name":      node.GpuName,
		"cost_per_hour": node.CostPerHour,
		"charged_quota": quotaToCharge,
	})
}

// GetComputeInstances lists the authenticated user's own compute instances.
func GetComputeInstances(c *gin.Context) {
	userId := c.GetInt("id")
	pageInfo := common.GetPageQuery(c)

	nodes, err := model.GetComputeNodesByUserId(userId, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	total, err := model.CountComputeNodesByUserId(userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"items":     nodes,
		"total":     total,
		"page":      pageInfo.GetPage(),
		"page_size": pageInfo.GetPageSize(),
	})
}

// GetComputeInstanceConnection returns SSH connection info for an instance the
// caller owns. ssh host/port is the customer's own rented card, so it is safe
// to surface — but the Connection struct is whitelabeled (no provider name).
func GetComputeInstanceConnection(c *gin.Context) {
	userId := c.GetInt("id")
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	node, err := model.GetUserComputeNodeById(id, userId)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			common.ApiErrorMsg(c, "compute node not found")
			return
		}
		common.ApiError(c, err)
		return
	}

	conn, err := compute.GetInstanceConnection(node.ProviderContractID)
	if err != nil {
		if errors.Is(err, compute.ErrProviderNotConfigured) {
			common.ApiErrorMsg(c, "compute provider is not configured")
			return
		}
		common.ApiError(c, err)
		return
	}

	// Opportunistically persist connection info once the instance has booted so
	// the reconciler/UI can show it without another upstream round-trip.
	if conn.HostIP != "" && (conn.HostIP != node.HostIP || conn.HostPort != node.HostPort) {
		if err := model.UpdateComputeNodeConnection(node.Id, conn.HostIP, conn.HostPort); err != nil {
			common.SysError("compute: failed to persist connection info: " + err.Error())
		}
	}

	common.ApiSuccess(c, conn)
}

// StopComputeInstance tears down an instance the caller owns and marks it
// stopped. (Settlement/refund of unused pre-paid time is a Phase-2 TODO — see
// note below.)
func StopComputeInstance(c *gin.Context) {
	userId := c.GetInt("id")
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	node, err := model.GetUserComputeNodeById(id, userId)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			common.ApiErrorMsg(c, "compute node not found")
			return
		}
		common.ApiError(c, err)
		return
	}

	if err := compute.StopNode(node.ProviderContractID); err != nil {
		if errors.Is(err, compute.ErrProviderNotConfigured) {
			common.ApiErrorMsg(c, "compute provider is not configured")
			return
		}
		common.ApiError(c, err)
		return
	}

	if err := model.UpdateComputeNodeStatus(node.Id, model.ComputeNodeStatusStopped); err != nil {
		common.ApiError(c, err)
		return
	}
	// TODO(Phase 2): pro-rate and refund the unused portion of the pre-paid
	// rental window here (needs a rental start_time + paid_hours on the row).
	model.RecordLog(userId, model.LogTypeSystem, fmt.Sprintf("stopped rented compute node %s (id: %d)", node.Label, node.Id))

	common.ApiSuccess(c, gin.H{"id": node.Id, "status": model.ComputeNodeStatusStopped})
}

// GetComputeOffers proxies available upstream GPU offers, stripped of all
// provider branding (only gpu / price / spec fields are surfaced).
func GetComputeOffers(c *gin.Context) {
	gpu := c.Query("gpu")
	offers, err := compute.SearchOffers(gpu)
	if err != nil {
		if errors.Is(err, compute.ErrProviderNotConfigured) {
			common.ApiErrorMsg(c, "compute provider is not configured")
			return
		}
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    gin.H{"items": offers},
	})
}

// GetUserGpuOffers is the user-facing offer catalog. Unlike the admin
// GetComputeOffers (which shows the raw upstream cost), it applies
// ComputeRentalMarkup so the displayed price equals what the customer is
// billed — the estimate on the rent form always matches the charge.
func GetUserGpuOffers(c *gin.Context) {
	offers, err := compute.SearchOffers(c.Query("gpu"))
	if err != nil {
		if errors.Is(err, compute.ErrProviderNotConfigured) {
			common.ApiErrorMsg(c, "compute provider is not configured")
			return
		}
		common.ApiError(c, err)
		return
	}
	for i := range offers {
		offers[i].CostPerHour = compute.CustomerHourlyPrice(offers[i].CostPerHour)
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    gin.H{"items": offers},
	})
}

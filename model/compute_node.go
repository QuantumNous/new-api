package model

import (
	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
)

// ComputeNode lifecycle status values (public, client-visible).
const (
	ComputeNodeStatusProvisioning = "provisioning"
	ComputeNodeStatusRunning      = "running"
	ComputeNodeStatusStopped      = "stopped"
	ComputeNodeStatusError        = "error"
)

// Internal provider identifiers (never surfaced to clients — whitelabel).
const (
	ComputeProviderVast = "vast"
)

// ComputeNode is a flatkey-branded GPU compute node backing the "flatkey
// Compute" rental line.
//
// WHITELABEL (critical): the underlying GPU marketplace provider (Vast.ai)
// MUST NOT be perceivable by customers or the admin UI. The provider-specific
// fields below (Provider / ProviderContractID / HostIP / HostPort /
// UpstreamKey) are internal-only and are tagged `json:"-"` so they are NEVER
// serialized into any API response. Everything the client sees is presented as
// a generic "flatkey compute node". Do not add these fields to any DTO or
// response payload, and do not log them.
type ComputeNode struct {
	// ---- Public fields (safe to serialize to clients) ----
	Id int `json:"id"`
	// UserId is the flatkey user who owns (rented) this node. User-facing
	// endpoints filter strictly by this column so a customer only ever sees
	// their own instances. 0 for admin/system-provisioned nodes.
	UserId      int     `json:"user_id" gorm:"column:user_id;index;default:0"`
	Label       string  `json:"label" gorm:"type:varchar(191);index"`
	GpuName     string  `json:"gpu_name" gorm:"column:gpu_name;type:varchar(191)"`
	CostPerHour float64 `json:"cost_per_hour" gorm:"column:cost_per_hour;default:0"`
	ModelServed string  `json:"model_served" gorm:"column:model_served;type:varchar(191);index"`
	Status      string  `json:"status" gorm:"type:varchar(32);index;default:provisioning"`
	ChannelId   int     `json:"channel_id" gorm:"column:channel_id;index;default:0"`
	CreatedTime int64   `json:"created_time" gorm:"column:created_time;bigint"`

	// ---- INTERNAL-ONLY fields (whitelabel: never serialize to clients) ----
	// These identify the upstream Vast.ai contract/host and MUST stay server-side.
	Provider           string `json:"-" gorm:"type:varchar(32);default:vast"`
	ProviderContractID string `json:"-" gorm:"column:provider_contract_id;type:varchar(191);index"`
	HostIP             string `json:"-" gorm:"column:host_ip;type:varchar(191)"`
	HostPort           int    `json:"-" gorm:"column:host_port;default:0"`
	UpstreamKey        string `json:"-" gorm:"column:upstream_key;type:varchar(512)"`
}

// Insert persists a new compute node row.
func (node *ComputeNode) Insert() error {
	if node.CreatedTime == 0 {
		node.CreatedTime = common.GetTimestamp()
	}
	if node.Status == "" {
		node.Status = ComputeNodeStatusProvisioning
	}
	if node.Provider == "" {
		node.Provider = ComputeProviderVast
	}
	return DB.Create(node).Error
}

// Update saves all columns of an existing compute node (by primary key).
func (node *ComputeNode) Update() error {
	return DB.Model(node).Updates(node).Error
}

// GetAllComputeNodes returns a page of compute nodes ordered by id.
func GetAllComputeNodes(startIdx int, num int) ([]*ComputeNode, error) {
	var nodes []*ComputeNode
	err := DB.Order("id desc").Limit(num).Offset(startIdx).Find(&nodes).Error
	return nodes, err
}

// CountComputeNodes returns the total number of compute nodes.
func CountComputeNodes() (int64, error) {
	var total int64
	err := DB.Model(&ComputeNode{}).Count(&total).Error
	return total, err
}

// GetComputeNodeById returns a single compute node by primary key.
func GetComputeNodeById(id int) (*ComputeNode, error) {
	if id == 0 {
		return nil, gorm.ErrRecordNotFound
	}
	var node ComputeNode
	if err := DB.First(&node, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &node, nil
}

// GetComputeNodeByContractID returns a node by its internal Vast contract id.
// Used by the reconciler; the contract id is never exposed to clients.
func GetComputeNodeByContractID(contractID string) (*ComputeNode, error) {
	if contractID == "" {
		return nil, gorm.ErrRecordNotFound
	}
	var node ComputeNode
	if err := DB.First(&node, "provider_contract_id = ?", contractID).Error; err != nil {
		return nil, err
	}
	return &node, nil
}

// UpdateComputeNodeStatus atomically updates a node's status column. Using a
// scoped column update keeps this safe under multi-node concurrency (Rule 11):
// no read-modify-write race, the DB row is the single source of truth.
func UpdateComputeNodeStatus(id int, status string) error {
	return DB.Model(&ComputeNode{}).
		Where("id = ?", id).
		Update("status", status).Error
}

// ComputeNodeStats is the header stat row for the admin dashboard.
type ComputeNodeStats struct {
	Total         int64   `json:"total"`
	Running       int64   `json:"running"`
	EstCostPerDay float64 `json:"est_cost_per_day"`
}

// GetComputeNodeStats returns aggregate counts and the estimated daily cost of
// currently running nodes. Uses COALESCE/SUM which are cross-DB safe (Rule 2).
func GetComputeNodeStats() (ComputeNodeStats, error) {
	var stats ComputeNodeStats
	if err := DB.Model(&ComputeNode{}).Count(&stats.Total).Error; err != nil {
		return stats, err
	}
	if err := DB.Model(&ComputeNode{}).
		Where("status = ?", ComputeNodeStatusRunning).
		Count(&stats.Running).Error; err != nil {
		return stats, err
	}
	var sumPerHour float64
	if err := DB.Model(&ComputeNode{}).
		Where("status = ?", ComputeNodeStatusRunning).
		Select("COALESCE(SUM(cost_per_hour), 0)").
		Row().Scan(&sumPerHour); err != nil {
		return stats, err
	}
	stats.EstCostPerDay = sumPerHour * 24
	return stats, nil
}

// GetComputeNodesByUserId returns a page of a single user's compute nodes,
// newest first. Used by the user-facing "my instances" endpoint.
func GetComputeNodesByUserId(userId int, startIdx int, num int) ([]*ComputeNode, error) {
	var nodes []*ComputeNode
	err := DB.Where("user_id = ?", userId).
		Order("id desc").Limit(num).Offset(startIdx).Find(&nodes).Error
	return nodes, err
}

// CountComputeNodesByUserId returns how many nodes a user owns.
func CountComputeNodesByUserId(userId int) (int64, error) {
	var total int64
	err := DB.Model(&ComputeNode{}).Where("user_id = ?", userId).Count(&total).Error
	return total, err
}

// GetUserComputeNodeById returns a node only if it belongs to userId. Ownership
// is enforced in the WHERE clause so a user can never read/stop another user's
// instance by guessing an id.
func GetUserComputeNodeById(id int, userId int) (*ComputeNode, error) {
	if id == 0 {
		return nil, gorm.ErrRecordNotFound
	}
	var node ComputeNode
	if err := DB.First(&node, "id = ? AND user_id = ?", id, userId).Error; err != nil {
		return nil, err
	}
	return &node, nil
}

// UpdateComputeNodeConnection persists the upstream connection info (host ip /
// ssh port) discovered after an instance finishes booting. Scoped single-row
// column write — safe under multi-node concurrency (Rule 11).
func UpdateComputeNodeConnection(id int, hostIP string, hostPort int) error {
	return DB.Model(&ComputeNode{}).
		Where("id = ?", id).
		Updates(map[string]any{"host_ip": hostIP, "host_port": hostPort}).Error
}

// ListSyncableComputeNodes returns nodes that have an upstream contract id, for
// the status reconciler. Only internal fields are used server-side.
func ListSyncableComputeNodes() ([]*ComputeNode, error) {
	var nodes []*ComputeNode
	err := DB.Where("provider_contract_id <> ?", "").Find(&nodes).Error
	return nodes, err
}

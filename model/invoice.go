package model

import (
	"errors"
	"time"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

// 增值税发票（docs/enterprise-features-design.md §三）。
// 可开票额度 = Σ已审批通过的对公转账到账金额 − Σ(待审核+已开具)发票金额（D5：仅对公转账）。
// 金额一律「分」整数（D1）；发票文件不加密（交付物，本人可随时下载，D6）；
// 状态流转沿用里程碑 1 评审确定的条件更新抢占模式（不依赖 FOR UPDATE）。

const (
	InvoiceStatusPending  = 1
	InvoiceStatusIssued   = 2
	InvoiceStatusRejected = 3

	InvoiceTypeNormal  = 1 // 增值税普通发票
	InvoiceTypeSpecial = 2 // 增值税专用发票
)

var (
	ErrInvoiceNotFound      = errors.New("发票申请不存在")
	ErrInvoiceNotPending    = errors.New("申请已处理，请刷新后查看")
	ErrInvoiceHasPending    = errors.New("已有待审核的发票申请，请等待审核完成")
	ErrInvoiceQuotaExceeded = errors.New("申请金额超出可开票额度")
	ErrInvoiceInvalidAmount = errors.New("无效的开票金额")
)

type InvoiceRequest struct {
	Id           int            `json:"id"            gorm:"primaryKey;autoIncrement"`
	UserId       int            `json:"user_id"       gorm:"index;not null"`
	AmountFen    int64          `json:"amount_fen"    gorm:"not null"`
	InvoiceType  int            `json:"invoice_type"  gorm:"type:int;not null;default:1"`
	Title        string         `json:"title"         gorm:"type:varchar(128);not null"` // 发票抬头
	TaxNo        string         `json:"tax_no"        gorm:"type:varchar(32);not null"`  // 税号（明文：发票要素本就交付给用户）
	Email        string         `json:"email"         gorm:"type:varchar(128);not null"` // 接收邮箱
	Remark       string         `json:"remark,omitempty"        gorm:"type:varchar(255)"`
	Status       int            `json:"status"        gorm:"type:int;not null;default:1;index"`
	RejectReason string         `json:"reject_reason,omitempty" gorm:"type:varchar(255)"`
	ReviewedBy   int            `json:"reviewed_by,omitempty"   gorm:"type:int"`
	SubmittedAt  *time.Time     `json:"submitted_at"`
	ReviewedAt   *time.Time     `json:"reviewed_at,omitempty"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `json:"-" gorm:"index"`
}

// InvoiceFile 发票文件（管理员开具时上传），1:1 挂在申请上。
// FileData 省略 type 标签走方言默认映射（MySQL longtext），同回执/认证图片表的处理；
// 不加密——发票是交付给用户的文件，不是平台核验材料。
type InvoiceFile struct {
	Id        int    `gorm:"primaryKey;autoIncrement"`
	InvoiceId int    `gorm:"uniqueIndex;not null"`
	UserId    int    `gorm:"index;not null"`
	FileName  string `gorm:"type:varchar(128)"` // 原始文件名（含扩展名）
	FileData  string `gorm:"not null"`          // base64
	CreatedAt time.Time
	UpdatedAt time.Time
	DeletedAt gorm.DeletedAt `gorm:"index"`
}

// sumUserInvoiceReservedFen 用户已占用的开票额度（待审核 + 已开具）。
func sumUserInvoiceReservedFen(db *gorm.DB, userId int) (int64, error) {
	var total int64
	err := db.Model(&InvoiceRequest{}).
		Where("user_id = ? AND status IN ?", userId, []int{InvoiceStatusPending, InvoiceStatusIssued}).
		Select("COALESCE(SUM(amount_fen), 0)").Scan(&total).Error
	return total, err
}

// sumUserInvoiceIssuedFen 用户已开具的发票总额。
func sumUserInvoiceIssuedFen(db *gorm.DB, userId int) (int64, error) {
	var total int64
	err := db.Model(&InvoiceRequest{}).
		Where("user_id = ? AND status = ?", userId, InvoiceStatusIssued).
		Select("COALESCE(SUM(amount_fen), 0)").Scan(&total).Error
	return total, err
}

// GetUserInvoiceAvailableFen 可开票额度（分）。负数按 0 返回（仅理论上的数据异常）。
func GetUserInvoiceAvailableFen(userId int) (int64, error) {
	approved, err := SumUserApprovedBankTransferFen(userId)
	if err != nil {
		return 0, err
	}
	reserved, err := sumUserInvoiceReservedFen(DB, userId)
	if err != nil {
		return 0, err
	}
	available := approved - reserved
	if available < 0 {
		available = 0
	}
	return available, nil
}

// CreateInvoiceRequest 提交开票申请（事务）。
// 限制：同一用户最多 1 笔待审核；金额 ≤ 提交时点可开票额度。
// 并发说明：两道校验与 INSERT 之间存在与"转账提交"同类的竞态窗口（已评审接受），
// 超开的资金风险由 IssueInvoice 开具时的权威额度复核兜底。
func CreateInvoiceRequest(userId int, amountFen int64, invoiceType int, title, taxNo, email, remark string) (*InvoiceRequest, error) {
	if amountFen <= 0 {
		return nil, ErrInvoiceInvalidAmount
	}
	now := time.Now()
	req := &InvoiceRequest{
		UserId:      userId,
		AmountFen:   amountFen,
		InvoiceType: invoiceType,
		Title:       title,
		TaxNo:       taxNo,
		Email:       email,
		Remark:      remark,
		Status:      InvoiceStatusPending,
		SubmittedAt: &now,
	}
	err := DB.Transaction(func(tx *gorm.DB) error {
		var pendingCount int64
		if err := tx.Model(&InvoiceRequest{}).
			Where("user_id = ? AND status = ?", userId, InvoiceStatusPending).
			Count(&pendingCount).Error; err != nil {
			return err
		}
		if pendingCount > 0 {
			return ErrInvoiceHasPending
		}

		var approved int64
		if err := tx.Model(&BankTransferOrder{}).
			Where("user_id = ? AND status = ?", userId, BankTransferStatusApproved).
			Select("COALESCE(SUM(amount_fen), 0)").Scan(&approved).Error; err != nil {
			return err
		}
		reserved, err := sumUserInvoiceReservedFen(tx, userId)
		if err != nil {
			return err
		}
		if amountFen > approved-reserved {
			return ErrInvoiceQuotaExceeded
		}

		return tx.Create(req).Error
	})
	if err != nil {
		return nil, err
	}
	return req, nil
}

func GetInvoiceById(id int) (*InvoiceRequest, error) {
	var req InvoiceRequest
	if err := DB.First(&req, id).Error; err != nil {
		return nil, err
	}
	return &req, nil
}

// GetUserLastInvoiceRequest 返回用户最近一次开票申请（按 id 倒序），用于前端默认填入开票信息。
// 不存在时返回 (nil, nil)。按 user_id 过滤，天然按用户隔离；持久于库，跨登录有效。
func GetUserLastInvoiceRequest(userId int) (*InvoiceRequest, error) {
	var req InvoiceRequest
	err := DB.Where("user_id = ?", userId).Order("id desc").First(&req).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &req, nil
}

func GetUserInvoices(userId int, pageInfo *common.PageInfo) (invoices []*InvoiceRequest, total int64, err error) {
	query := DB.Model(&InvoiceRequest{}).Where("user_id = ?", userId)
	if err = query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err = query.Order("id desc").Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&invoices).Error
	if err != nil {
		return nil, 0, err
	}
	return invoices, total, nil
}

// CancelInvoiceRequest 用户撤销自己的待审核申请：条件软删抢占（同转账撤销模式）。
func CancelInvoiceRequest(userId int, id int) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		var req InvoiceRequest
		if err := tx.Where("id = ? AND user_id = ?", id, userId).First(&req).Error; err != nil {
			return ErrInvoiceNotFound
		}
		res := tx.Where("id = ? AND user_id = ? AND status = ?", id, userId, InvoiceStatusPending).
			Delete(&InvoiceRequest{})
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return ErrInvoiceNotPending
		}
		return nil
	})
}

// IssueInvoice 管理员开具：权威额度复核 → 条件更新抢占 → 写入发票文件，同一事务内。
// 权威复核保证 Σ(已开具) + 本笔 ≤ Σ(已通过转账)，即"开出的发票永远不超过实际到账"——
// 这是提交侧竞态（已评审接受）的资金安全兜底。
func IssueInvoice(id int, reviewerId int, fileName string, fileData string) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		req := &InvoiceRequest{}
		if err := tx.Where("id = ?", id).First(req).Error; err != nil {
			return ErrInvoiceNotFound
		}

		// 按用户串行化开具：对该用户的 users 行做一次无副作用更新（quota+0），
		// 在 MySQL/PG 上持有该行写锁直到事务提交，同一用户的并发开具被迫排队，
		// 后到事务读到新鲜的"已开具总额"，杜绝权威复核被并发穿透导致的超开。
		// 跨库安全：不使用 FOR UPDATE 语法；SQLite 单写者天然串行。users 表无
		// updated_at 自动戳，quota+0 不改变任何字段值，仅用于取锁。
		if err := tx.Model(&User{}).Where("id = ?", req.UserId).
			Update("quota", gorm.Expr("quota + ?", 0)).Error; err != nil {
			return err
		}

		var approved int64
		if err := tx.Model(&BankTransferOrder{}).
			Where("user_id = ? AND status = ?", req.UserId, BankTransferStatusApproved).
			Select("COALESCE(SUM(amount_fen), 0)").Scan(&approved).Error; err != nil {
			return err
		}
		issued, err := sumUserInvoiceIssuedFen(tx, req.UserId)
		if err != nil {
			return err
		}
		if issued+req.AmountFen > approved {
			return ErrInvoiceQuotaExceeded
		}

		now := time.Now()
		res := tx.Model(&InvoiceRequest{}).
			Where("id = ? AND status = ?", id, InvoiceStatusPending).
			Updates(map[string]interface{}{
				"status":      InvoiceStatusIssued,
				"reviewed_by": reviewerId,
				"reviewed_at": now,
			})
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return ErrInvoiceNotPending
		}

		return tx.Create(&InvoiceFile{
			InvoiceId: id,
			UserId:    req.UserId,
			FileName:  fileName,
			FileData:  fileData,
		}).Error
	})
}

// RejectInvoice 管理员拒绝，原因必填（controller 校验）。条件更新抢占。
func RejectInvoice(id int, reviewerId int, reason string) error {
	var exists int64
	if err := DB.Model(&InvoiceRequest{}).Where("id = ?", id).Count(&exists).Error; err != nil {
		return err
	}
	if exists == 0 {
		return ErrInvoiceNotFound
	}
	now := time.Now()
	res := DB.Model(&InvoiceRequest{}).
		Where("id = ? AND status = ?", id, InvoiceStatusPending).
		Updates(map[string]interface{}{
			"status":        InvoiceStatusRejected,
			"reject_reason": reason,
			"reviewed_by":   reviewerId,
			"reviewed_at":   now,
		})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return ErrInvoiceNotPending
	}
	return nil
}

func GetInvoiceFile(invoiceId int) (*InvoiceFile, error) {
	var file InvoiceFile
	if err := DB.Where("invoice_id = ?", invoiceId).First(&file).Error; err != nil {
		return nil, err
	}
	return &file, nil
}

// InvoiceAdminRow 管理员列表 JOIN 结果。
type InvoiceAdminRow struct {
	InvoiceRequest
	Username     string `gorm:"column:username"`
	ReviewerName string `gorm:"column:reviewer_name"`
}

// GetInvoiceList 管理员分页列表。status=0 表示全部；keyword 按用户名/抬头模糊。
func GetInvoiceList(status int, keyword string, page, pageSize int) ([]*InvoiceAdminRow, int64, error) {
	var rows []*InvoiceAdminRow
	var total int64

	buildQuery := func() *gorm.DB {
		q := DB.Model(&InvoiceRequest{}).
			Joins("LEFT JOIN users u1 ON u1.id = invoice_requests.user_id")
		if status != 0 {
			q = q.Where("invoice_requests.status = ?", status)
		}
		if keyword != "" {
			like := "%" + keyword + "%"
			q = q.Where("u1.username LIKE ? OR invoice_requests.title LIKE ?", like, like)
		}
		return q
	}

	if err := buildQuery().Count(&total).Error; err != nil {
		return nil, 0, err
	}

	query := buildQuery().
		Select("invoice_requests.*, u1.username AS username, u2.username AS reviewer_name").
		Joins("LEFT JOIN users u2 ON u2.id = invoice_requests.reviewed_by")

	offset := (page - 1) * pageSize
	if err := query.Order("invoice_requests.id DESC").Offset(offset).Limit(pageSize).Scan(&rows).Error; err != nil {
		return nil, 0, err
	}
	return rows, total, nil
}

// CountPendingInvoice 待审核发票申请数（status=待审核）。
func CountPendingInvoice() (int64, error) {
	var n int64
	err := DB.Model(&InvoiceRequest{}).
		Where("status = ?", InvoiceStatusPending).Count(&n).Error
	return n, err
}

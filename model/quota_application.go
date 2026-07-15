package model

// QuotaApplication 额度申请单：用户/部门管理员提交，审批人（超管/财务/本部门部门管理员）批准后
// 从总预算池扣减并拨付至申请人个人余额（详见研发任务卡 T5 事务路径）。
type QuotaApplication struct {
	Id           int64   `json:"id" gorm:"primaryKey;autoIncrement"`
	ApplicantId  int     `json:"applicant_id" gorm:"index"`
	ApplicantName string `json:"applicant_name" gorm:"type:varchar(64)"`
	Dept         string  `json:"dept" gorm:"type:varchar(64)"`
	Amount       float64 `json:"amount" gorm:"type:decimal(18,2);not null"` // 单位：元
	Reason       string  `json:"reason" gorm:"type:varchar(512)"`
	Status       string  `json:"status" gorm:"type:varchar(16);not null;default:'pending'"` // pending/approved/rejected
	ApproverId   int     `json:"approver_id"`
	ApproverName string  `json:"approver_name" gorm:"type:varchar(64)"`
	CreatedAt    int64   `json:"created_at" gorm:"autoCreateTime;column:created_at"`
	DecidedAt    int64   `json:"decided_at" gorm:"column:decided_at"`
	RejectReason string  `json:"reject_reason" gorm:"type:varchar(512)"`
}

func (QuotaApplication) TableName() string { return "quota_application" }

// GetQuotaApplicationById 按主键查询申请单；未找到返回 gorm.ErrRecordNotFound。
func GetQuotaApplicationById(id int64) (*QuotaApplication, error) {
	var app QuotaApplication
	err := DB.Where("id = ?", id).First(&app).Error
	if err != nil {
		return nil, err
	}
	return &app, nil
}

package model

import (
	"time"

	"gorm.io/gorm"
)

// UserParentBinding records each bind/unbind episode between a parent and child
// account. A row is created when a child is bound (unbound_at = 0 = still
// active) and updated when the relationship ends. This lets the stats queries
// sum only the quota_data rows that fall inside at least one binding window.
type UserParentBinding struct {
	Id        int   `json:"id"`
	ParentId  int   `json:"parent_id" gorm:"not null;index:idx_upb_parent_child,priority:1;index:idx_upb_parent_time,priority:1"`
	ChildId   int   `json:"child_id"  gorm:"not null;index:idx_upb_parent_child,priority:2;index:idx_upb_child"`
	BoundAt   int64 `json:"bound_at"  gorm:"not null;index:idx_upb_parent_time,priority:2"`
	UnboundAt int64 `json:"unbound_at" gorm:"not null;default:0"` // 0 = still active
}

// recordBind inserts a new open binding inside an existing transaction.
func recordBind(tx *gorm.DB, parentId, childId int) error {
	return tx.Create(&UserParentBinding{
		ParentId:  parentId,
		ChildId:   childId,
		BoundAt:   time.Now().Unix(),
		UnboundAt: 0,
	}).Error
}

// recordUnbind closes every open binding for the child inside an existing
// transaction. Passing parentId = 0 closes bindings with any parent (used
// when a child detaches itself without knowing the parent).
func recordUnbind(tx *gorm.DB, childId, parentId int) error {
	q := tx.Model(&UserParentBinding{}).Where("child_id = ? AND unbound_at = 0", childId)
	if parentId > 0 {
		q = q.Where("parent_id = ?", parentId)
	}
	return q.Update("unbound_at", time.Now().Unix()).Error
}

// BackfillCurrentBindings inserts an open binding record for every user whose
// parent_id is currently set but has no open binding entry. Called once after
// the table is created so new stats accumulate from the migration point onward.
func BackfillCurrentBindings() error {
	type pair struct {
		Id       int
		ParentId int
	}
	var rows []pair
	if err := DB.Model(&User{}).
		Select("id, parent_id").
		Where("parent_id > 0").
		Scan(&rows).Error; err != nil {
		return err
	}

	now := time.Now().Unix()
	for _, r := range rows {
		var existing UserParentBinding
		err := DB.Where("child_id = ? AND unbound_at = 0", r.Id).First(&existing).Error
		if err == nil {
			continue // already has an open record
		}
		if err := DB.Create(&UserParentBinding{
			ParentId:  r.ParentId,
			ChildId:   r.Id,
			BoundAt:   now,
			UnboundAt: 0,
		}).Error; err != nil {
			return err
		}
	}
	return nil
}

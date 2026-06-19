package model

import (
	"errors"
	"fmt"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"gorm.io/gorm"
)

// 企业子账户（docs/enterprise-features-design.md 功能C）。
//
// 设计不变量（实现与评审都要守住）：
//   - 子账户只是「只读视图」，永不出现在计费链路里。绑定只是一条查看授权记录，
//     不改变 key 的所有权（tokens.user_id 不动），key 的消耗永远扣企业主账户。
//   - 「是不是子账户 / 属于谁」由 users.parent_user_id 单一字段回答（>0 即子账户）。
//   - 一个 key 至多绑给一个子账户（TokenId uniqueIndex 兜底）；一个子账户可绑多个 key。
//
// 已知并接受的竞态（评审确认 2026-06-10，接受不修）：
//   1. DeleteSubAccount 在事务内校验「无绑定」后删除，但与并发的 BindTokenToSubAccount
//      属不同事务，极端交错下软删的子账户可能残留一条绑定记录；
//   2. controller 侧 DeleteToken/DeleteTokenBatch 的绑定保护检查在删除事务之外，
//      与并发 bind 交错时已删 token 可能残留绑定。
//   两者后果均仅为父账户绑定列表出现一条可手动解绑的孤儿记录（查询侧按 user_id +
//   软删过滤兜底，不泄漏、不影响计费与资金），且为管理 UI 单人低频操作，故不引入
//   跨表行锁串行化（对比 IssueInvoice：那里涉及资金所以上了用户行锁）。

// SubAccountTokenBinding 子账户↔令牌的查看授权记录。独立表而非在 tokens 上加列，
// 避免触碰上游核心表的合并面与 updated 语义。
type SubAccountTokenBinding struct {
	Id           int       `json:"id"             gorm:"primaryKey;autoIncrement"`
	ParentUserId int       `json:"parent_user_id" gorm:"index;not null"`       // 企业主账户 id（冗余存储，便于按企业批量清理与校验）
	SubUserId    int       `json:"sub_user_id"    gorm:"index;not null"`       // 子账户 user_id
	TokenId      int       `json:"token_id"       gorm:"uniqueIndex;not null"` // 一个 key 最多绑给一个子账户
	CreatedAt    time.Time `json:"created_at"`
}

var (
	ErrSubAccountNotFound     = errors.New("子账户不存在")
	ErrSubAccountLimitReached = errors.New("子账户数量已达上限")
	ErrSubAccountHasBindings  = errors.New("该子账户仍有绑定的令牌，请先解除全部绑定")
	ErrTokenAlreadyBound      = errors.New("该令牌已绑定子账户，请先解绑")
	ErrBindingNotFound        = errors.New("绑定关系不存在")
)

// CountSubAccountsByParent 统计某企业主账户名下的子账户数量（不含软删）。
func CountSubAccountsByParent(parentId int) (int64, error) {
	var count int64
	err := DB.Model(&User{}).Where("parent_user_id = ?", parentId).Count(&count).Error
	return count, err
}

// GetSubAccountsByParent 返回某企业主账户名下的全部子账户。
func GetSubAccountsByParent(parentId int) ([]*User, error) {
	var users []*User
	err := DB.Where("parent_user_id = ?", parentId).Order("id desc").Find(&users).Error
	return users, err
}

// GetBindingCountsByParent 返回 parent 名下每个子账户的绑定令牌数：map[subUserId]count。
func GetBindingCountsByParent(parentId int) (map[int]int, error) {
	type row struct {
		SubUserId int
		Cnt       int
	}
	var rows []row
	err := DB.Model(&SubAccountTokenBinding{}).
		Select("sub_user_id, count(*) as cnt").
		Where("parent_user_id = ?", parentId).
		Group("sub_user_id").
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	result := make(map[int]int, len(rows))
	for _, r := range rows {
		result[r.SubUserId] = r.Cnt
	}
	return result, nil
}

// GetLastUsedTimesByParent 返回 parent 名下每个子账户「绑定令牌中最近一次使用时间」的映射
// （sub_user_id -> max(tokens.accessed_time)，秒）。无绑定/从未使用的子账户不在结果里，前端按空展示。
// 不用 JOIN：先取绑定关系，再用 token_id IN (...) 单查 accessed_time，纯 GORM 三库通用。
func GetLastUsedTimesByParent(parentId int) (map[int]int64, error) {
	type bindRow struct {
		SubUserId int
		TokenId   int
	}
	var binds []bindRow
	if err := DB.Model(&SubAccountTokenBinding{}).
		Select("sub_user_id, token_id").
		Where("parent_user_id = ?", parentId).
		Scan(&binds).Error; err != nil {
		return nil, err
	}
	if len(binds) == 0 {
		return map[int]int64{}, nil
	}
	tokenIds := make([]int, 0, len(binds))
	for _, b := range binds {
		tokenIds = append(tokenIds, b.TokenId)
	}
	type tokRow struct {
		Id           int
		AccessedTime int64
	}
	var toks []tokRow
	if err := DB.Model(&Token{}).
		Select("id, accessed_time").
		Where("id IN ?", tokenIds).
		Scan(&toks).Error; err != nil {
		return nil, err
	}
	accessed := make(map[int]int64, len(toks))
	for _, tk := range toks {
		accessed[tk.Id] = tk.AccessedTime
	}
	result := make(map[int]int64, len(binds))
	for _, b := range binds {
		if at := accessed[b.TokenId]; at > result[b.SubUserId] {
			result[b.SubUserId] = at
		}
	}
	return result, nil
}

// CreateSubAccount 创建一个隶属于 parentId 的只读子账户。
//
// 与普通注册的关键差异（设计 §4.3）：
//   - quota=0、不发放任何注册赠送额度、不参与邀请体系（inviter_id 不写）；
//   - role 恒为 RoleCommonUser、status=enabled、parent_user_id=parentId。
//
// 调用方（controller）负责：enterprise_status==2 前置校验、用户名/密码格式校验、
// 用户名唯一性预检与数量上限校验。这里在事务内复检数量上限，防并发越限。
func CreateSubAccount(parentId int, username, password, displayName string) (*User, error) {
	hashed, err := common.Password2Hash(password)
	if err != nil {
		return nil, err
	}
	if displayName == "" {
		displayName = username
	}

	var created *User
	err = DB.Transaction(func(tx *gorm.DB) error {
		// 事务内复检上限，杜绝并发创建越过 MaxCount。
		var count int64
		if err := tx.Model(&User{}).Where("parent_user_id = ?", parentId).Count(&count).Error; err != nil {
			return err
		}
		if count >= int64(operation_setting.GetSubAccountMaxCount()) {
			return ErrSubAccountLimitReached
		}
		user := &User{
			Username:     username,
			Password:     hashed,
			DisplayName:  displayName,
			Role:         common.RoleCommonUser,
			Status:       common.UserStatusEnabled,
			Quota:        0,
			ParentUserId: parentId,
			AffCode:      common.GetRandomString(4),
		}
		if err := tx.Create(user).Error; err != nil {
			return err
		}
		created = user
		return nil
	})
	if err != nil {
		return nil, err
	}
	return created, nil
}

// GetSubAccount 取出归属校验后的子账户：必须存在且 parent_user_id==parentId，防越权（IDOR）。
func GetSubAccount(subUserId, parentId int) (*User, error) {
	var user User
	err := DB.Where("id = ? AND parent_user_id = ?", subUserId, parentId).First(&user).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrSubAccountNotFound
		}
		return nil, err
	}
	return &user, nil
}

// ResetSubAccountPassword 重置子账户密码（调用方已做归属校验）。
func ResetSubAccountPassword(subUserId int, newPassword string) error {
	hashed, err := common.Password2Hash(newPassword)
	if err != nil {
		return err
	}
	if err := DB.Model(&User{}).Where("id = ?", subUserId).Update("password", hashed).Error; err != nil {
		return err
	}
	return invalidateUserCache(subUserId)
}

// SetSubAccountStatus 启用/禁用子账户（status 复用 users.status；禁用后无法登录）。
func SetSubAccountStatus(subUserId int, status int) error {
	if err := DB.Model(&User{}).Where("id = ?", subUserId).Update("status", status).Error; err != nil {
		return err
	}
	return invalidateUserCache(subUserId)
}

// DeleteSubAccount 删除子账户（软删 user）。前置：名下不能有任何绑定记录。
// 该校验在事务内进行，防止「校验通过→并发新增绑定→删除」的竞态留下悬空绑定。
func DeleteSubAccount(subUserId, parentId int) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		var sub User
		if err := tx.Where("id = ? AND parent_user_id = ?", subUserId, parentId).First(&sub).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrSubAccountNotFound
			}
			return err
		}
		var bindingCount int64
		if err := tx.Model(&SubAccountTokenBinding{}).Where("sub_user_id = ?", subUserId).Count(&bindingCount).Error; err != nil {
			return err
		}
		if bindingCount > 0 {
			return ErrSubAccountHasBindings
		}
		if err := tx.Delete(&sub).Error; err != nil {
			return err
		}
		return nil
	})
}

// GetBoundTokenIdsBySubUser 返回某子账户已绑定的全部 token_id，用于数据范围过滤。
func GetBoundTokenIdsBySubUser(subUserId int) ([]int, error) {
	var ids []int
	err := DB.Model(&SubAccountTokenBinding{}).
		Where("sub_user_id = ?", subUserId).
		Pluck("token_id", &ids).Error
	return ids, err
}

// GetBindingsBySubUser 返回某子账户的全部绑定记录（归属由调用方校验）。
func GetBindingsBySubUser(subUserId int) ([]*SubAccountTokenBinding, error) {
	var bindings []*SubAccountTokenBinding
	err := DB.Where("sub_user_id = ?", subUserId).Order("id desc").Find(&bindings).Error
	return bindings, err
}

// GetBindingByTokenId 返回某 token 的绑定记录（不存在返回 nil, nil）。
func GetBindingByTokenId(tokenId int) (*SubAccountTokenBinding, error) {
	var binding SubAccountTokenBinding
	err := DB.Where("token_id = ?", tokenId).First(&binding).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &binding, nil
}

// GetBindingsByTokenIds 返回一批 token 中已被绑定的记录，用于批量删除保护与令牌列表「已绑定」徽标。
func GetBindingsByTokenIds(tokenIds []int) ([]*SubAccountTokenBinding, error) {
	if len(tokenIds) == 0 {
		return nil, nil
	}
	var bindings []*SubAccountTokenBinding
	err := DB.Where("token_id IN ?", tokenIds).Find(&bindings).Error
	return bindings, err
}

// BindTokenToSubAccount 绑定 key 到子账户。事务内强校验归属与唯一性：
//   - 子账户必须隶属 parentId；
//   - token 必须属于 parentId（防绑别家的 key，IDOR）；
//   - token 未被任何子账户绑定（uniqueIndex 兜底，事务内先查给出友好提示）。
func BindTokenToSubAccount(parentId, subUserId, tokenId int) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		var sub User
		if err := tx.Where("id = ? AND parent_user_id = ?", subUserId, parentId).First(&sub).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrSubAccountNotFound
			}
			return err
		}
		var token Token
		if err := tx.Where("id = ? AND user_id = ?", tokenId, parentId).First(&token).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return errors.New("令牌不存在或不属于当前企业账户")
			}
			return err
		}
		var existing int64
		if err := tx.Model(&SubAccountTokenBinding{}).Where("token_id = ?", tokenId).Count(&existing).Error; err != nil {
			return err
		}
		if existing > 0 {
			return ErrTokenAlreadyBound
		}
		binding := &SubAccountTokenBinding{
			ParentUserId: parentId,
			SubUserId:    subUserId,
			TokenId:      tokenId,
		}
		return tx.Create(binding).Error
	})
}

// UnbindTokenFromSubAccount 解绑。强校验：绑定记录必须属于 parentId 且 sub_user_id 匹配。
func UnbindTokenFromSubAccount(parentId, subUserId, tokenId int) error {
	result := DB.Where("parent_user_id = ? AND sub_user_id = ? AND token_id = ?", parentId, subUserId, tokenId).
		Delete(&SubAccountTokenBinding{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrBindingNotFound
	}
	return nil
}

// cascadeDeleteSubAccountsForParent 企业主账户被删除时跟随处理（设计 §4.3 异常路径）：
// 软删其全部子账户、硬删该企业名下的全部绑定记录。运维级删号是逃生通道，不受绑定保护约束。
// 在 user.Delete() 内调用；错误非致命（审计/关系数据），仅记录。
func cascadeDeleteSubAccountsForParent(tx *gorm.DB, parentId int) {
	// 硬删该企业名下全部绑定（含其各子账户的绑定）。
	if err := tx.Where("parent_user_id = ?", parentId).Delete(&SubAccountTokenBinding{}).Error; err != nil {
		common.SysLog(fmt.Sprintf("cascade delete sub-account bindings for parent %d failed: %s", parentId, err.Error()))
	}
	// 软删全部子账户。
	if err := tx.Where("parent_user_id = ?", parentId).Delete(&User{}).Error; err != nil {
		common.SysLog(fmt.Sprintf("cascade soft-delete sub-accounts for parent %d failed: %s", parentId, err.Error()))
	}
}

package service

import (
	"fmt"
	"math"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

// ProcessTopUpCommission 充值成功后处理返佣逻辑
// userId: 充值用户（被邀请人A）
// topUpId: 充值记录ID
// topUpMoney: 充值金额（元）
func ProcessTopUpCommission(userId int, topUpId int, topUpMoney float64) {
	if !common.CommissionEnabled {
		return
	}
	if topUpMoney <= 0 {
		return
	}

	// 获取用户信息，检查是否有邀请人
	user, err := model.GetUserById(userId, false)
	if err != nil || user == nil || user.InviterId == 0 {
		return
	}
	inviterId := user.InviterId

	// 1. 充值返佣：注册后1个月内的前3次充值
	processTopUpBonus(user, inviterId, topUpId, topUpMoney)

	// 2. 高价值用户返佣：注册后3个月内累计充值达到门槛
	processHighValueBonus(user, inviterId)
}

// processTopUpBonus 处理充值返佣（前3次充值）
func processTopUpBonus(user *model.User, inviterId int, topUpId int, topUpMoney float64) {
	// 检查是否在注册后30天内
	registeredAt := time.Unix(user.CreatedAt, 0)
	if time.Now().After(registeredAt.AddDate(0, 0, 30)) {
		return
	}

	// 统计已发放的充值返佣次数（初步检查，事务内会再次检查）
	count, err := model.CountUserCommissionsByType(user.Id, inviterId, model.CommissionTypeTopUp)
	if err != nil || count >= 3 {
		return
	}

	sequence := int(count) + 1
	var ratio float64
	switch sequence {
	case 1:
		ratio = common.CommissionTopUpRatio1
	case 2:
		ratio = common.CommissionTopUpRatio2
	case 3:
		ratio = common.CommissionTopUpRatio3
	}

	if ratio <= 0 {
		return
	}

	// 计算佣金（分），向下取整
	commissionAmount := int(math.Floor(topUpMoney * ratio / 100.0 * 100))
	if commissionAmount <= 0 {
		return
	}

	commission := &model.Commission{
		UserId:           user.Id,
		InviterId:        inviterId,
		TopUpId:          topUpId,
		Type:             model.CommissionTypeTopUp,
		Sequence:         sequence,
		Ratio:            ratio,
		TopUpMoney:       topUpMoney,
		CommissionAmount: commissionAmount,
		Remark:           fmt.Sprintf("第%d次充值返佣 %.2f%%", sequence, ratio),
	}

	created, err := model.CreateTopUpCommissionIfNotExists(commission)
	if err != nil {
		common.SysError(fmt.Sprintf("创建充值返佣记录失败: userId=%d, inviterId=%d, err=%s", user.Id, inviterId, err.Error()))
		return
	}
	if !created {
		return
	}

	model.RecordLog(inviterId, model.LogTypeSystem,
		fmt.Sprintf("获得充值返佣: 被邀请人第%d次充值 %.2f 元，返佣比例 %.2f%%，佣金 %.2f 元",
			sequence, topUpMoney, ratio, float64(commissionAmount)/100.0))
}

// processHighValueBonus 处理高价值用户返佣
func processHighValueBonus(user *model.User, inviterId int) {
	threshold := common.CommissionHighValueThreshold
	bonus := common.CommissionHighValueBonus
	if threshold <= 0 || bonus <= 0 {
		return
	}

	// 初步检查是否已发放（事务内会再次检查）
	hasBonus, err := model.HasHighValueCommission(user.Id, inviterId)
	if err != nil || hasBonus {
		return
	}

	// 检查是否在注册后90天内
	registeredAt := time.Unix(user.CreatedAt, 0)
	if time.Now().After(registeredAt.AddDate(0, 0, 90)) {
		return
	}

	// 检查累计充值是否达到门槛
	totalMoney, err := model.GetUserRecentTopUpMoney(user.Id, 90)
	if err != nil || totalMoney < float64(threshold) {
		return
	}

	commission := &model.Commission{
		UserId:           user.Id,
		InviterId:        inviterId,
		Type:             model.CommissionTypeHighValue,
		TopUpMoney:       totalMoney,
		CommissionAmount: bonus,
		Remark:           fmt.Sprintf("高价值用户奖励: 累计充值 %.2f 元，达到 %d 元门槛", totalMoney, threshold),
	}

	created, err := model.CreateHighValueCommissionIfNotExists(commission)
	if err != nil {
		common.SysError(fmt.Sprintf("创建高价值返佣记录失败: userId=%d, inviterId=%d, err=%s", user.Id, inviterId, err.Error()))
		return
	}
	if !created {
		return
	}

	model.RecordLog(inviterId, model.LogTypeSystem,
		fmt.Sprintf("获得高价值用户奖励: 被邀请人累计充值 %.2f 元，奖励 %.2f 元",
			totalMoney, float64(bonus)/100.0))
}

// ManualIssueCommission 管理员手动发放佣金
func ManualIssueCommission(userId int, inviterId int, amount int, remark string) error {
	// 验证佣金接收用户是否存在
	_, err := model.GetUserById(inviterId, false)
	if err != nil {
		return fmt.Errorf("佣金接收用户 (ID=%d) 不存在", inviterId)
	}

	commission := &model.Commission{
		UserId:           userId,
		InviterId:        inviterId,
		Type:             model.CommissionTypeManual,
		CommissionAmount: amount,
		Remark:           remark,
	}

	if err := model.CreateCommissionWithBalance(commission); err != nil {
		return err
	}

	model.RecordLog(inviterId, model.LogTypeSystem,
		fmt.Sprintf("管理员手动发放佣金 %.2f 元，备注: %s", float64(amount)/100.0, remark))

	return nil
}

package controller

import (
	"net/http"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

func GetAllRedemptions(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	redemptions, total, err := model.GetAllRedemptions(pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(redemptions)
	common.ApiSuccess(c, pageInfo)
	return
}

func SearchRedemptions(c *gin.Context) {
	keyword := c.Query("keyword")
	pageInfo := common.GetPageQuery(c)
	redemptions, total, err := model.SearchRedemptions(keyword, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(redemptions)
	common.ApiSuccess(c, pageInfo)
	return
}

func GetRedemption(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	redemption, err := model.GetRedemptionById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    redemption,
	})
	return
}

func AddRedemption(c *gin.Context) {
	redemption := model.Redemption{}
	err := c.ShouldBindJSON(&redemption)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if utf8.RuneCountInString(redemption.Name) == 0 || utf8.RuneCountInString(redemption.Name) > 20 {
		common.ApiErrorI18n(c, i18n.MsgRedemptionNameLength)
		return
	}
	if redemption.Count <= 0 {
		common.ApiErrorI18n(c, i18n.MsgRedemptionCountPositive)
		return
	}
	if redemption.Count > 100 {
		common.ApiErrorI18n(c, i18n.MsgRedemptionCountMax)
		return
	}
	if valid, msg := validateExpiredTime(c, redemption.ExpiredTime); !valid {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": msg})
		return
	}

	// 验证兑换码类型
	if redemption.Type != common.RedemptionTypeQuota && redemption.Type != common.RedemptionTypeSubscription && redemption.Type != common.RedemptionTypeCombo {
		redemption.Type = common.RedemptionTypeQuota // 默认为余额类型
	}

	// 如果是订阅类型，验证订阅套餐ID
	if redemption.Type == common.RedemptionTypeSubscription {
		if redemption.SubscriptionPlanId <= 0 {
			common.ApiErrorMsg(c, "订阅类型兑换码必须指定订阅套餐ID")
			return
		}
		// 验证订阅套餐是否存在
		_, err := model.GetSubscriptionPlanById(redemption.SubscriptionPlanId)
		if err != nil {
			common.ApiErrorMsg(c, "指定的订阅套餐不存在")
			return
		}
	}

	// 如果是联合类型，验证额度和订阅套餐ID
	if redemption.Type == common.RedemptionTypeCombo {
		if redemption.Quota <= 0 {
			common.ApiErrorMsg(c, "联合兑换码必须设置额度")
			return
		}
		if redemption.SubscriptionPlanId <= 0 {
			common.ApiErrorMsg(c, "联合兑换码必须指定订阅套餐ID")
			return
		}
		_, err := model.GetSubscriptionPlanById(redemption.SubscriptionPlanId)
		if err != nil {
			common.ApiErrorMsg(c, "指定的订阅套餐不存在")
			return
		}
	}

	// 验证 upgrade_group_rollback
	if redemption.IsUpgradeGroupRollback() && redemption.Type == common.RedemptionTypeQuota {
		// type=1 无订阅，不支持到期回退，强制 false
		falseVal := false
		redemption.UpgradeGroupRollback = &falseVal
	}
	if redemption.IsUpgradeGroupRollback() && strings.TrimSpace(redemption.UpgradeGroup) == "" {
		common.ApiErrorMsg(c, "启用分组到期回退时必须指定升级分组")
		return
	}

	var keys []string
	for i := 0; i < redemption.Count; i++ {
		key := common.GetUUID()
		cleanRedemption := model.Redemption{
			UserId:               c.GetInt("id"),
			Name:                 redemption.Name,
			Key:                  key,
			CreatedTime:          common.GetTimestamp(),
			Quota:                redemption.Quota,
			ExpiredTime:          redemption.ExpiredTime,
			Type:                 redemption.Type,
			SubscriptionPlanId:   redemption.SubscriptionPlanId,
			UpgradeGroup:         redemption.UpgradeGroup,
			UpgradeGroupRollback: redemption.UpgradeGroupRollback,
		}
		err = cleanRedemption.Insert()
		if err != nil {
			common.SysError("failed to insert redemption: " + err.Error())
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": i18n.T(c, i18n.MsgRedemptionCreateFailed),
				"data":    keys,
			})
			return
		}
		keys = append(keys, key)
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    keys,
	})
	return
}

func DeleteRedemption(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	err := model.DeleteRedemptionById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
	return
}

func UpdateRedemption(c *gin.Context) {
	statusOnly := c.Query("status_only")
	redemption := model.Redemption{}
	err := c.ShouldBindJSON(&redemption)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	cleanRedemption, err := model.GetRedemptionById(redemption.Id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if statusOnly == "" {
		if valid, msg := validateExpiredTime(c, redemption.ExpiredTime); !valid {
			c.JSON(http.StatusOK, gin.H{"success": false, "message": msg})
			return
		}
		// 验证兑换码类型
		if redemption.Type != common.RedemptionTypeQuota && redemption.Type != common.RedemptionTypeSubscription && redemption.Type != common.RedemptionTypeCombo {
			redemption.Type = common.RedemptionTypeQuota
		}
		// 如果是订阅类型，验证订阅套餐ID
		if redemption.Type == common.RedemptionTypeSubscription && redemption.SubscriptionPlanId <= 0 {
			common.ApiErrorMsg(c, "订阅类型兑换码必须指定订阅套餐ID")
			return
		}
		// 如果是联合类型，验证额度和订阅套餐ID
		if redemption.Type == common.RedemptionTypeCombo {
			if redemption.Quota <= 0 {
				common.ApiErrorMsg(c, "联合兑换码必须设置额度")
				return
			}
			if redemption.SubscriptionPlanId <= 0 {
				common.ApiErrorMsg(c, "联合兑换码必须指定订阅套餐ID")
				return
			}
		}
		// If you add more fields, please also update redemption.Update()
		cleanRedemption.Name = redemption.Name
		cleanRedemption.Quota = redemption.Quota
		cleanRedemption.ExpiredTime = redemption.ExpiredTime
		cleanRedemption.Type = redemption.Type
		cleanRedemption.SubscriptionPlanId = redemption.SubscriptionPlanId
		cleanRedemption.UpgradeGroup = redemption.UpgradeGroup
		// 验证 upgrade_group_rollback
		if redemption.IsUpgradeGroupRollback() && redemption.Type == common.RedemptionTypeQuota {
			falseVal := false
			redemption.UpgradeGroupRollback = &falseVal
		}
		if redemption.IsUpgradeGroupRollback() && strings.TrimSpace(redemption.UpgradeGroup) == "" {
			common.ApiErrorMsg(c, "启用分组到期回退时必须指定升级分组")
			return
		}
		cleanRedemption.UpgradeGroupRollback = redemption.UpgradeGroupRollback
	}
	if statusOnly != "" {
		cleanRedemption.Status = redemption.Status
	}
	err = cleanRedemption.Update()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    cleanRedemption,
	})
	return
}

func DeleteInvalidRedemption(c *gin.Context) {
	rows, err := model.DeleteInvalidRedemptions()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    rows,
	})
	return
}

func validateExpiredTime(c *gin.Context, expired int64) (bool, string) {
	if expired != 0 && expired < common.GetTimestamp() {
		return false, i18n.T(c, i18n.MsgRedemptionExpireTimeInvalid)
	}
	return true, ""
}

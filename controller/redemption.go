package controller

import (
	crand "crypto/rand"
	"errors"
	"fmt"
	"math/big"
	"net/http"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
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
	req := dto.CreateRedemptionRequest{}
	err := c.ShouldBindJSON(&req)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	if utf8.RuneCountInString(req.Name) == 0 || utf8.RuneCountInString(req.Name) > 20 {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "兑换码名称长度必须在1-20之间",
		})
		return
	}

	count := req.EffectiveCount()
	if count <= 0 {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "兑换码个数必须大于0",
		})
		return
	}

	const maxCount = 100

	if count > maxCount {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": fmt.Sprintf("一次兑换码批量生成的个数不能大于 %d", maxCount),
		})
		return
	}

	// 随机额度模式校验
	if req.RandomQuotaMode() {
		if req.QuotaMin == nil || req.QuotaMax == nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "启用随机额度需同时提供 quota_min 与 quota_max",
			})
			return
		}
		if *req.QuotaMin <= 0 || *req.QuotaMax <= 0 {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "quota_min 和 quota_max 必须大于 0",
			})
			return
		}
		if *req.QuotaMin > *req.QuotaMax {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "quota_min 不能大于 quota_max",
			})
			return
		}
	} else {
		if req.Quota <= 0 {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "额度必须大于 0",
			})
			return
		}
	}

	if err := validateExpiredTime(req.ExpiredTime); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	keys := make([]string, 0, count)
	keyPrefix := strings.TrimSpace(req.KeyPrefix)

	for i := 0; i < count; i++ {
		// 生成 Key：前缀 + UUID
		key := keyPrefix + common.GetUUID()

		// 确定额度：随机模式或固定模式
		quota := req.Quota
		if req.RandomQuotaMode() {
			randomQuota, err := cryptoRandIntInclusive(*req.QuotaMin, *req.QuotaMax)
			if err != nil {
				c.JSON(http.StatusOK, gin.H{
					"success": false,
					"message": "生成随机额度失败: " + err.Error(),
					"data":    keys,
					"keys":    keys,
				})
				return
			}
			quota = randomQuota
		}

		cleanRedemption := model.Redemption{
			UserId:      c.GetInt("id"),
			Name:        req.Name,
			Key:         key,
			CreatedTime: common.GetTimestamp(),
			Quota:       quota,
			ExpiredTime: req.ExpiredTime,
		}
		err = cleanRedemption.Insert()
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": err.Error(),
				"data":    keys,
				"keys":    keys,
			})
			return
		}
		keys = append(keys, key)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    keys,
		"keys":    keys,
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
		if err := validateExpiredTime(redemption.ExpiredTime); err != nil {
			c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
			return
		}
		// If you add more fields, please also update redemption.Update()
		cleanRedemption.Name = redemption.Name
		cleanRedemption.Quota = redemption.Quota
		cleanRedemption.ExpiredTime = redemption.ExpiredTime
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

func validateExpiredTime(expired int64) error {
	if expired != 0 && expired < common.GetTimestamp() {
		return errors.New("过期时间不能早于当前时间")
	}
	return nil
}

func cryptoRandIntInclusive(min int, max int) (int, error) {
	if min > max {
		return 0, errors.New("invalid range: min > max")
	}
	rangeSize := new(big.Int).SetInt64(int64(max - min + 1))
	n, err := crand.Int(crand.Reader, rangeSize)
	if err != nil {
		return 0, err
	}
	return int(n.Int64()) + min, nil
}

func isUniqueConstraintError(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	// MySQL: Error 1062 / Duplicate entry
	if strings.Contains(msg, "error 1062") || strings.Contains(msg, "duplicate entry") {
		return true
	}
	// PostgreSQL: SQLSTATE 23505 / duplicate key value violates unique constraint
	if strings.Contains(msg, "sqlstate 23505") || strings.Contains(msg, "duplicate key value violates unique constraint") {
		return true
	}
	// SQLite: UNIQUE constraint failed
	if strings.Contains(msg, "unique constraint failed") {
		return true
	}
	return false
}

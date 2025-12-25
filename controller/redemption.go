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

	const maxUUIDCount = 100
	const maxRandomCount = 100000

	// random_* 只要出现任意字段，就进入随机生成模式（但必须提供 min/max）
	if req.RandomEnabled() {
		if req.RandomMin == nil || req.RandomMax == nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "启用随机兑换码需同时提供 random_min 与 random_max",
			})
			return
		}
		if *req.RandomMin > *req.RandomMax {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "random_min 不能大于 random_max",
			})
			return
		}
		if count > maxRandomCount {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": fmt.Sprintf("一次随机兑换码批量生成的个数不能大于 %d", maxRandomCount),
			})
			return
		}
		capacity := *req.RandomMax - *req.RandomMin + 1
		if capacity < int64(count) {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "随机区间容量不足（random_max-random_min+1 必须 >= count）",
			})
			return
		}
	} else {
		if count > maxUUIDCount {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": fmt.Sprintf("一次兑换码批量生成的个数不能大于 %d", maxUUIDCount),
			})
			return
		}
	}

	if err := validateExpiredTime(req.ExpiredTime); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	keys := make([]string, 0, count)

	// 随机生成：先内存去重，再落库处理唯一索引冲突（重试）。
	if req.RandomEnabled() {
		randomMin := *req.RandomMin
		randomMax := *req.RandomMax
		prefix := req.RandomPrefix

		seen := make(map[int64]struct{}, count)
		for len(seen) < count {
			n, err := cryptoRandInt64Inclusive(randomMin, randomMax)
			if err != nil {
				c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
				return
			}
			seen[n] = struct{}{}
		}

		candidates := make([]int64, 0, count)
		for n := range seen {
			candidates = append(candidates, n)
		}

		maxAttempts := count * 10
		if maxAttempts < 10 {
			maxAttempts = 10
		}

		attempts := 0
		for len(keys) < count && attempts < maxAttempts {
			var numeric int64
			if len(candidates) > 0 {
				numeric = candidates[len(candidates)-1]
				candidates = candidates[:len(candidates)-1]
			} else {
				// 极端情况下（落库碰撞太多）再生成新的随机数补齐（仍然内存去重）
				n, err := cryptoRandInt64Inclusive(randomMin, randomMax)
				if err != nil {
					c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
					return
				}
				if _, ok := seen[n]; ok {
					attempts++
					continue
				}
				seen[n] = struct{}{}
				numeric = n
			}

			key := prefix + strconv.FormatInt(numeric, 10)
			cleanRedemption := model.Redemption{
				UserId:      c.GetInt("id"),
				Name:        req.Name,
				Key:         key,
				CreatedTime: common.GetTimestamp(),
				Quota:       req.Quota,
				ExpiredTime: req.ExpiredTime,
			}
			err = cleanRedemption.Insert()
			if err != nil {
				if isUniqueConstraintError(err) {
					attempts++
					continue
				}
				c.JSON(http.StatusOK, gin.H{
					"success": false,
					"message": err.Error(),
					"data":    keys,
					"keys":    keys,
				})
				return
			}
			keys = append(keys, key)
			attempts++
		}

		if len(keys) < count {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": fmt.Sprintf("随机兑换码生成失败：唯一键冲突重试达到上限（%d/%d）", len(keys), count),
				"data":    keys,
				"keys":    keys,
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "",
			"data":    keys,
			"keys":    keys,
		})
		return
	}

	// 旧逻辑：继续使用 UUID（同时也做唯一冲突重试兜底）
	for i := 0; i < count; i++ {
		key := common.GetUUID()
		cleanRedemption := model.Redemption{
			UserId:      c.GetInt("id"),
			Name:        req.Name,
			Key:         key,
			CreatedTime: common.GetTimestamp(),
			Quota:       req.Quota,
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

func cryptoRandInt64Inclusive(min int64, max int64) (int64, error) {
	if min > max {
		return 0, errors.New("invalid range: min > max")
	}
	// rangeSize = max-min+1, must fit into big.Int
	rangeSize := new(big.Int).SetInt64(max - min + 1)
	n, err := crand.Int(crand.Reader, rangeSize)
	if err != nil {
		return 0, err
	}
	return n.Int64() + min, nil
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

package controller

import (
	"fmt"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

// CreateCombo handles POST /api/combo/
func CreateCombo(c *gin.Context) {
	var combo model.Combo
	if err := c.ShouldBindJSON(&combo); err != nil {
		common.ApiErrorMsg(c, fmt.Sprintf("Invalid request: %s", err.Error()))
		return
	}

	// Validate required fields
	if combo.Name == "" {
		common.ApiErrorMsg(c, "Combo name is required")
		return
	}
	if combo.Models == "" {
		common.ApiErrorMsg(c, "At least one model is required")
		return
	}
	if combo.Strategy == "" {
		combo.Strategy = "fallback"
	}
	if combo.Strategy != "fallback" && combo.Strategy != "random" && combo.Strategy != "weighted" && combo.Strategy != "round_robin" {
		common.ApiErrorMsg(c, "Strategy must be one of: fallback, random, weighted, round_robin")
		return
	}
	userId := c.GetInt("id")
	combo.UserId = userId
	combo.Status = 1
	combo.CreatedTime = time.Now().Unix()

	// Check name uniqueness scoped to this user.
	if existing, _ := model.GetComboByNameUserId(combo.Name, userId); existing != nil {
		common.ApiErrorMsg(c, "Combo name already exists")
		return
	}

	if err := combo.Insert(); err != nil {
		common.ApiErrorMsg(c, fmt.Sprintf("Failed to create combo: %s", err.Error()))
		return
	}

	common.ApiSuccess(c, combo)
}

// GetComboList handles GET /api/combo/
func GetComboList(c *gin.Context) {
	userId := c.GetInt("id")
	role := c.GetInt("role")
	pageInfo := common.GetPageQuery(c)

	var combos []*model.Combo
	var total int64
	var err error

	if role >= common.RoleAdminUser {
		// Admins see all combos
		combos, total, err = model.GetAllCombos(pageInfo)
	} else {
		combos, err = model.GetCombosByUserId(userId)
		if err == nil {
			total = int64(len(combos))
		}
	}

	if err != nil {
		common.ApiErrorMsg(c, fmt.Sprintf("Failed to get combos: %s", err.Error()))
		return
	}

	if combos == nil {
		combos = []*model.Combo{}
	}

	common.ApiSuccess(c, gin.H{
		"items":     combos,
		"total":     total,
		"page":      pageInfo.GetPage(),
		"page_size": pageInfo.GetPageSize(),
	})
}

// GetCombo handles GET /api/combo/:id
func GetCombo(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		common.ApiErrorMsg(c, "Invalid combo id")
		return
	}

	combo, err := model.GetComboById(id)
	if err != nil {
		common.ApiErrorMsg(c, "Combo not found")
		return
	}

	// Ownership check: admin or owner
	userId := c.GetInt("id")
	role := c.GetInt("role")
	if role < common.RoleAdminUser && combo.UserId != userId {
		common.ApiErrorMsg(c, "Combo not found")
		return
	}

	common.ApiSuccess(c, combo)
}

// UpdateCombo handles PUT /api/combo/:id
func UpdateCombo(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		common.ApiErrorMsg(c, "Invalid combo id")
		return
	}

	combo, err := model.GetComboById(id)
	if err != nil {
		common.ApiErrorMsg(c, "Combo not found")
		return
	}

	// Ownership check
	userId := c.GetInt("id")
	role := c.GetInt("role")
	if role < common.RoleAdminUser && combo.UserId != userId {
		common.ApiErrorMsg(c, "Combo not found")
		return
	}

	var updateData model.Combo
	if err := c.ShouldBindJSON(&updateData); err != nil {
		common.ApiErrorMsg(c, fmt.Sprintf("Invalid request: %s", err.Error()))
		return
	}

	if updateData.Name != "" {
		// Check name uniqueness scoped to this user.
		if existing, _ := model.GetComboByNameUserId(updateData.Name, combo.UserId); existing != nil && existing.Id != combo.Id {
			common.ApiErrorMsg(c, "Combo name already exists")
			return
		}
		combo.Name = updateData.Name
	}

	if updateData.Status >= 0 && updateData.Status <= 1 {
		combo.Status = updateData.Status
	}

	if err := combo.Update(); err != nil {
		common.ApiErrorMsg(c, fmt.Sprintf("Failed to update combo: %s", err.Error()))
		return
	}

	common.ApiSuccess(c, combo)
}

// DeleteCombo handles DELETE /api/combo/:id
func DeleteCombo(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		common.ApiErrorMsg(c, "Invalid combo id")
		return
	}

	userId := c.GetInt("id")
	role := c.GetInt("role")

	var delErr error
	if role >= common.RoleAdminUser {
		delErr = model.DeleteComboById(id)
	} else {
		delErr = model.DeleteComboById(id, userId)
	}

	if delErr != nil {
		common.ApiErrorMsg(c, fmt.Sprintf("Failed to delete combo: %s", delErr.Error()))
		return
	}

	common.ApiSuccess(c, gin.H{"id": id})
}

// SearchCombos handles GET /api/combo/search
func SearchCombos(c *gin.Context) {
	keyword := c.Query("keyword")
	if keyword == "" {
		common.ApiErrorMsg(c, "Search keyword is required")
		return
	}

	pageInfo := common.GetPageQuery(c)
	combos, total, err := model.SearchCombos(keyword, pageInfo)
	if err != nil {
		common.ApiErrorMsg(c, fmt.Sprintf("Failed to search combos: %s", err.Error()))
		return
	}

	if combos == nil {
		combos = []*model.Combo{}
	}

	common.ApiSuccess(c, gin.H{
		"items":     combos,
		"total":     total,
		"page":      pageInfo.GetPage(),
		"page_size": pageInfo.GetPageSize(),
	})
}

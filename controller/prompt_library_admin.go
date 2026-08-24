package controller

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

type promptLibraryAdminItemInput struct {
	promptLibraryImportItem
	Enabled bool `json:"enabled"`
}

func ListPromptLibraryAdmin(c *gin.Context) {
	category := strings.TrimSpace(c.Query("category"))
	if category != "" && !model.IsPromptLibraryCategoryAllowed(category) {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "category is invalid"})
		return
	}
	keyword := strings.TrimSpace(c.Query("keyword"))
	pageInfo := common.GetPageQuery(c)
	items, total, err := model.ListPromptLibraryItems(category, keyword, false, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(items)
	common.ApiSuccess(c, pageInfo)
}

func CreatePromptLibraryAdmin(c *gin.Context) {
	item, ok := bindPromptLibraryAdminItem(c)
	if !ok {
		return
	}
	existing, err := model.GetPromptLibraryItemBySlug(item.Slug)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if existing != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "slug already exists"})
		return
	}
	if err := model.CreatePromptLibraryItem(item); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"id": item.Id})
}

func UpdatePromptLibraryAdmin(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid id"})
		return
	}
	current, err := model.GetPromptLibraryItemById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if current == nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "prompt library item not found"})
		return
	}
	item, ok := bindPromptLibraryAdminItem(c)
	if !ok {
		return
	}
	if item.Slug != current.Slug {
		other, err := model.GetPromptLibraryItemBySlug(item.Slug)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		if other != nil && other.Id != id {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "slug already exists"})
			return
		}
	}
	item.Id = id
	item.CreatedTime = current.CreatedTime
	if err := item.Update(); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"id": id})
}

// UpdatePromptLibraryEnabledAdmin toggles only the enabled flag. Unlike the
// full-replace PUT /:id it cannot clobber concurrently edited content fields.
func UpdatePromptLibraryEnabledAdmin(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid id"})
		return
	}
	var input struct {
		Enabled bool `json:"enabled"`
	}
	if err := common.DecodeJson(c.Request.Body, &input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid JSON body"})
		return
	}
	rowsAffected, err := model.SetPromptLibraryItemEnabled(id, input.Enabled)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if rowsAffected == 0 {
		// MySQL reports 0 rows affected when the UPDATE changed nothing (same
		// enabled value within the same updated_time second), which is
		// indistinguishable from "no such row" at the model layer. Re-check
		// existence so an idempotent no-op toggle is not misreported as 404.
		// (sqlite in tests counts matched rows even without changes, so this
		// branch is only reachable on MySQL-like backends.)
		item, err := model.GetPromptLibraryItemById(id)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		if item == nil {
			c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "prompt library item not found"})
			return
		}
	}
	common.ApiSuccess(c, gin.H{"id": id, "enabled": input.Enabled})
}

func DeletePromptLibraryAdmin(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid id"})
		return
	}
	if err := model.DeletePromptLibraryItemById(id); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

// bindPromptLibraryAdminItem parses and validates the body; on failure the
// response is already written and ok=false. Unlike the import path it does not
// require the model to be available on Flatkey (admins may curate examples for
// any model).
// PUT is full-replace: omitted optional fields are cleared (summary/tags/output/captured_at
// included); clients must round-trip source_json faithfully.
func bindPromptLibraryAdminItem(c *gin.Context) (*model.PromptLibraryItem, bool) {
	var input promptLibraryAdminItemInput
	if err := common.DecodeJson(c.Request.Body, &input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid JSON body"})
		return nil, false
	}
	item, err := normalizePromptLibraryImportItem(input.promptLibraryImportItem)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return nil, false
	}
	item.Enabled = input.Enabled
	return &item, true
}

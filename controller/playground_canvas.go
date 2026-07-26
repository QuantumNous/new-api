package controller

import (
	"errors"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const playgroundCanvasDocMaxBytes = 2_000_000

func ListPlaygroundCanvasProjects(c *gin.Context) {
	userId := c.GetInt("id")
	page := 0
	if v := strings.TrimSpace(c.Query("p")); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n >= 0 {
			page = n
		}
	}
	pageSize := 50
	if v := strings.TrimSpace(c.Query("page_size")); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			pageSize = n
		}
	}
	if pageSize > 100 {
		pageSize = 100
	}
	offset := page * pageSize
	items, total, err := model.ListPlaygroundCanvasProjects(userId, offset, pageSize)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"projects": items, "total": total})
}

func CreatePlaygroundCanvasProject(c *gin.Context) {
	userId := c.GetInt("id")
	var body struct {
		Title string `json:"title"`
		Doc   string `json:"doc"`
		Cover string `json:"cover"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		common.ApiError(c, err)
		return
	}
	if len(body.Doc) > playgroundCanvasDocMaxBytes {
		common.ApiErrorMsg(c, "canvas document is too large")
		return
	}
	title := strings.TrimSpace(body.Title)
	if title == "" {
		title = "Untitled canvas"
	}
	title = truncateRunes(title, 120)
	p := &model.PlaygroundCanvasProject{
		UserId: userId,
		Title:  title,
		Doc:    body.Doc,
		Cover:  truncateRunes(strings.TrimSpace(body.Cover), 500),
	}
	if err := model.CreatePlaygroundCanvasProject(p); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, p)
}

func GetPlaygroundCanvasProject(c *gin.Context) {
	userId := c.GetInt("id")
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorMsg(c, "invalid id")
		return
	}
	p, err := model.GetPlaygroundCanvasProject(id, userId)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			common.ApiErrorMsg(c, "canvas project not found")
			return
		}
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, p)
}

func UpdatePlaygroundCanvasProject(c *gin.Context) {
	userId := c.GetInt("id")
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorMsg(c, "invalid id")
		return
	}
	var body struct {
		Title         *string `json:"title"`
		Doc           *string `json:"doc"`
		Cover         *string `json:"cover"`
		BaseUpdatedAt int64   `json:"base_updated_at"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		common.ApiError(c, err)
		return
	}
	updates := map[string]any{}
	if body.Title != nil {
		title := strings.TrimSpace(*body.Title)
		if title == "" {
			title = "Untitled canvas"
		}
		updates["title"] = truncateRunes(title, 120)
	}
	if body.Cover != nil {
		updates["cover"] = truncateRunes(strings.TrimSpace(*body.Cover), 500)
	}
	if body.Doc != nil {
		if len(*body.Doc) > playgroundCanvasDocMaxBytes {
			common.ApiErrorMsg(c, "canvas document is too large")
			return
		}
		updates["doc"] = *body.Doc
	}
	if len(updates) == 0 {
		common.ApiErrorMsg(c, "nothing to update")
		return
	}
	if body.Doc != nil {
		if previous, err := model.GetPlaygroundCanvasProject(id, userId); err == nil {
			if snapErr := model.SnapshotPlaygroundCanvasProject(previous); snapErr != nil {
				common.SysError("failed to snapshot canvas project: " + snapErr.Error())
			}
		}
	}
	newUpdatedAt, err := model.UpdatePlaygroundCanvasProject(id, userId, body.BaseUpdatedAt, updates)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			if _, getErr := model.GetPlaygroundCanvasProject(id, userId); getErr != nil {
				if errors.Is(getErr, gorm.ErrRecordNotFound) {
					common.ApiErrorMsg(c, "canvas project not found")
					return
				}
				common.ApiError(c, getErr)
				return
			}
			common.ApiErrorMsg(c, "canvas project was modified elsewhere")
			return
		}
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"updated_at": newUpdatedAt})
}

func ListPlaygroundCanvasVersions(c *gin.Context) {
	userId := c.GetInt("id")
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorMsg(c, "invalid id")
		return
	}
	versions, err := model.ListPlaygroundCanvasVersions(id, userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"versions": versions})
}

func GetPlaygroundCanvasVersion(c *gin.Context) {
	userId := c.GetInt("id")
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorMsg(c, "invalid id")
		return
	}
	versionId, err := strconv.Atoi(c.Param("versionId"))
	if err != nil || versionId <= 0 {
		common.ApiErrorMsg(c, "invalid version id")
		return
	}
	version, err := model.GetPlaygroundCanvasVersion(versionId, id, userId)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			common.ApiErrorMsg(c, "canvas version not found")
			return
		}
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, version)
}

func DeletePlaygroundCanvasProject(c *gin.Context) {
	userId := c.GetInt("id")
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorMsg(c, "invalid id")
		return
	}
	if err := model.DeletePlaygroundCanvasProject(id, userId); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			common.ApiErrorMsg(c, "canvas project not found")
			return
		}
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

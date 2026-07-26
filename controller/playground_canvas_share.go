package controller

import (
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func canvasShareProjectID(c *gin.Context) (int, bool) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorMsg(c, "invalid id")
		return 0, false
	}
	return id, true
}

func createCanvasShare(c *gin.Context) {
	projectId, ok := canvasShareProjectID(c)
	if !ok {
		return
	}
	var body struct {
		ExpiresInDays int `json:"expires_in_days"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		common.ApiError(c, err)
		return
	}
	if body.ExpiresInDays != 0 && body.ExpiresInDays != 7 && body.ExpiresInDays != 30 {
		common.ApiErrorMsg(c, "expiration must be 7, 30, or 0 days")
		return
	}
	random := make([]byte, 32)
	if _, err := rand.Read(random); err != nil {
		common.ApiError(c, err)
		return
	}
	token := base64.RawURLEncoding.EncodeToString(random)
	expiresAt := int64(0)
	if body.ExpiresInDays > 0 {
		expiresAt = time.Now().Add(time.Duration(body.ExpiresInDays) * 24 * time.Hour).Unix()
	}
	share, err := model.UpsertPlaygroundCanvasShare(projectId, c.GetInt("id"), model.PlaygroundCanvasShareTokenHash(token), expiresAt)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"token": token, "expires_at": share.ExpiresAt, "created_at": share.CreatedAt})
}

func CreatePlaygroundCanvasShare(c *gin.Context) { createCanvasShare(c) }
func RotatePlaygroundCanvasShare(c *gin.Context) { createCanvasShare(c) }

func GetPlaygroundCanvasShareStatus(c *gin.Context) {
	projectId, ok := canvasShareProjectID(c)
	if !ok {
		return
	}
	share, err := model.GetPlaygroundCanvasShareStatus(projectId, c.GetInt("id"))
	if errors.Is(err, gorm.ErrRecordNotFound) {
		common.ApiSuccess(c, gin.H{"active": false})
		return
	}
	if err != nil {
		common.ApiError(c, err)
		return
	}
	active := share.RevokedAt == 0 && (share.ExpiresAt == 0 || share.ExpiresAt > time.Now().Unix())
	common.ApiSuccess(c, gin.H{"active": active, "expires_at": share.ExpiresAt, "created_at": share.CreatedAt})
}

func RevokePlaygroundCanvasShare(c *gin.Context) {
	projectId, ok := canvasShareProjectID(c)
	if !ok {
		return
	}
	if err := model.RevokePlaygroundCanvasShare(projectId, c.GetInt("id")); err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func rewriteCanvasShareDocument(doc, token string) (string, map[int]struct{}, map[string]string, error) {
	var value any
	if err := common.UnmarshalJsonStr(doc, &value); err != nil {
		return "", nil, nil, err
	}
	assetIds := map[int]struct{}{}
	replacements := map[string]string{}
	var visit func(any)
	visit = func(current any) {
		switch item := current.(type) {
		case []any:
			for _, child := range item {
				visit(child)
			}
		case map[string]any:
			assetNumber, hasAsset := item["assetId"].(float64)
			assetId := int(assetNumber)
			if hasAsset && assetNumber == float64(assetId) && assetId > 0 {
				assetIds[assetId] = struct{}{}
				proxy := fmt.Sprintf("/api/share/canvas/%s/assets/%d", token, assetId)
				if content, ok := item["content"].(string); ok && content != "" {
					replacements[content] = proxy
					item["content"] = proxy
				}
			}
			for _, child := range item {
				visit(child)
			}
		}
	}
	visit(value)
	encoded, err := common.Marshal(value)
	return string(encoded), assetIds, replacements, err
}

func GetPublicPlaygroundCanvas(c *gin.Context) {
	token := strings.TrimSpace(c.Param("token"))
	if len(token) != 43 {
		c.Status(http.StatusNotFound)
		return
	}
	_, project, err := model.GetActivePlaygroundCanvasShare(token, time.Now().Unix())
	if err != nil {
		c.Status(http.StatusNotFound)
		return
	}
	doc, _, replacements, err := rewriteCanvasShareDocument(project.Doc, token)
	if err != nil {
		c.Status(http.StatusNotFound)
		return
	}
	cover := project.Cover
	if replacement, ok := replacements[cover]; ok {
		cover = replacement
	}
	common.ApiSuccess(c, gin.H{"title": project.Title, "doc": doc, "cover": cover})
}

func GetPublicPlaygroundCanvasAsset(c *gin.Context) {
	token := strings.TrimSpace(c.Param("token"))
	assetId, err := strconv.Atoi(c.Param("assetId"))
	if len(token) != 43 || err != nil || assetId <= 0 {
		c.Status(http.StatusNotFound)
		return
	}
	_, project, err := model.GetActivePlaygroundCanvasShare(token, time.Now().Unix())
	if err != nil {
		c.Status(http.StatusNotFound)
		return
	}
	_, assetIds, _, err := rewriteCanvasShareDocument(project.Doc, token)
	if err != nil {
		c.Status(http.StatusNotFound)
		return
	}
	if _, referenced := assetIds[assetId]; !referenced {
		c.Status(http.StatusNotFound)
		return
	}
	asset, err := model.GetPlaygroundAsset(assetId, project.UserId)
	if err != nil {
		c.Status(http.StatusNotFound)
		return
	}
	body, err := service.OpenPlaygroundAssetContentDirect(c.Request.Context(), asset.Backend, asset.StorageKey)
	if err != nil {
		c.Status(http.StatusNotFound)
		return
	}
	defer body.Close()
	c.Header("Content-Type", asset.Mime)
	c.Header("X-Content-Type-Options", "nosniff")
	c.Header("Cache-Control", "private, max-age=300")
	c.Status(http.StatusOK)
	if _, err := io.Copy(c.Writer, body); err != nil {
		common.SysError("stream shared canvas asset: " + err.Error())
	}
}

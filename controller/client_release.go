package controller

import (
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"gopkg.in/yaml.v3"
)

type clientReleaseRequest struct {
	Version      string `json:"version"`
	Platform     string `json:"platform"`
	Arch         string `json:"arch"`
	Channel      string `json:"channel"`
	FileName     string `json:"fileName"`
	ObjectKey    string `json:"objectKey"`
	Size         int64  `json:"size"`
	SHA256       string `json:"sha256"`
	SHA512       string `json:"sha512"`
	ReleaseNotes string `json:"releaseNotes"`
	MinVersion   string `json:"minVersion"`
	Forced       bool   `json:"forced"`
	Published    bool   `json:"published"`
	Status       *int   `json:"status"`
}

type clientReleaseDirectUploadInitRequest struct {
	Version  string `json:"version"`
	Platform string `json:"platform"`
	Arch     string `json:"arch"`
	Channel  string `json:"channel"`
	FileName string `json:"fileName"`
	Size     int64  `json:"size"`
}

type clientReleaseDirectUploadCompleteRequest struct {
	UploadTicket string `json:"uploadTicket"`
}

type electronLatestYAML struct {
	Version     string                   `yaml:"version"`
	Files       []electronLatestYAMLFile `yaml:"files"`
	Path        string                   `yaml:"path"`
	SHA512      string                   `yaml:"sha512"`
	ReleaseDate string                   `yaml:"releaseDate"`
}

type electronLatestYAMLFile struct {
	URL    string `yaml:"url"`
	SHA512 string `yaml:"sha512"`
	Size   int64  `yaml:"size"`
}

func ListClientReleases(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	releases, total, err := model.SearchClientReleases(
		c.Query("keyword"),
		c.Query("platform"),
		c.Query("arch"),
		c.Query("channel"),
		false,
		pageInfo.GetStartIdx(),
		pageInfo.GetPageSize(),
	)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, model.ClientReleaseListResponse{
		Items: model.ClientReleasesToResponses(releases, false, func(release *model.ClientRelease) string {
			return clientReleaseDownloadURL(c, release)
		}),
		Total: total,
	})
}

func GetLatestClientRelease(c *gin.Context) {
	latest, err := model.GetLatestClientRelease(
		c.Query("platform"),
		c.Query("arch"),
		c.Query("channel"),
	)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	currentVersion := strings.TrimSpace(c.Query("current_version"))
	if currentVersion == "" {
		currentVersion = strings.TrimSpace(c.Query("version"))
	}
	if latest == nil {
		common.ApiSuccess(c, gin.H{
			"updateAvailable": false,
			"currentVersion":  currentVersion,
		})
		return
	}
	updateAvailable := currentVersion == "" || model.CompareClientVersions(latest.Version, currentVersion) > 0
	forceUpdate := false
	if latest.Forced && latest.MinVersion != "" && currentVersion != "" {
		forceUpdate = model.CompareClientVersions(currentVersion, latest.MinVersion) < 0
		if forceUpdate {
			updateAvailable = true
		}
	}
	common.ApiSuccess(c, gin.H{
		"updateAvailable": updateAvailable,
		"forceUpdate":     forceUpdate,
		"currentVersion":  currentVersion,
		"latest":          latest.ToResponse(false, clientReleaseDownloadURL(c, latest)),
	})
}

func GetClientReleaseLatestYAML(c *gin.Context) {
	latest, err := model.GetLatestClientRelease(
		c.Param("platform"),
		c.Param("arch"),
		c.Param("channel"),
	)
	if err != nil {
		c.String(http.StatusBadRequest, err.Error())
		return
	}
	if latest == nil {
		c.String(http.StatusNotFound, "client release not found")
		return
	}
	if strings.TrimSpace(latest.SHA512) == "" {
		c.String(http.StatusInternalServerError, "client release sha512 is required")
		return
	}
	assetPath := fmt.Sprintf(
		"download/%d/%s",
		latest.Id,
		url.PathEscape(latest.FileName),
	)
	payload := electronLatestYAML{
		Version: latest.Version,
		Files: []electronLatestYAMLFile{
			{
				URL:    assetPath,
				SHA512: latest.SHA512,
				Size:   latest.Size,
			},
		},
		Path:        assetPath,
		SHA512:      latest.SHA512,
		ReleaseDate: clientReleaseTime(latest).Format(time.RFC3339),
	}
	body, err := yaml.Marshal(payload)
	if err != nil {
		c.String(http.StatusInternalServerError, err.Error())
		return
	}
	c.Header("Content-Type", "text/yaml; charset=utf-8")
	c.String(http.StatusOK, string(body))
}

func DownloadClientRelease(c *gin.Context) {
	downloadClientReleaseByParam(c, "id")
}

func DownloadClientReleaseAsset(c *gin.Context) {
	downloadClientReleaseByParam(c, "id")
}

func AdminListClientReleases(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	releases, total, err := model.SearchClientReleases(
		c.Query("keyword"),
		c.Query("platform"),
		c.Query("arch"),
		c.Query("channel"),
		true,
		pageInfo.GetStartIdx(),
		pageInfo.GetPageSize(),
	)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, model.ClientReleaseListResponse{
		Items: model.ClientReleasesToResponses(releases, true, func(release *model.ClientRelease) string {
			return clientReleaseDownloadURL(c, release)
		}),
		Total: total,
	})
}

func AdminGetClientRelease(c *gin.Context) {
	release, err := clientReleaseByParam(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, release.ToResponse(true, clientReleaseDownloadURL(c, release)))
}

func AdminInitClientReleaseDirectUpload(c *gin.Context) {
	var request clientReleaseDirectUploadInitRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		common.ApiError(c, err)
		return
	}
	result, err := service.InitClientReleaseDirectUpload(service.ClientReleaseDirectUploadInput{
		Version:  request.Version,
		Platform: request.Platform,
		Arch:     request.Arch,
		Channel:  request.Channel,
		FileName: request.FileName,
		Size:     request.Size,
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, result)
}

func AdminCompleteClientReleaseDirectUpload(c *gin.Context) {
	var request clientReleaseDirectUploadCompleteRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		common.ApiError(c, err)
		return
	}
	result, err := service.CompleteClientReleaseDirectUpload(request.UploadTicket)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, result)
}

func AdminDiscardClientReleaseDirectUpload(c *gin.Context) {
	var request clientReleaseDirectUploadCompleteRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := service.DiscardClientReleaseDirectUpload(request.UploadTicket); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func AdminCreateClientRelease(c *gin.Context) {
	var request clientReleaseRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		common.ApiError(c, err)
		return
	}
	release := clientReleaseRequestToModel(request, nil)
	promotion, err := service.PromoteClientReleaseObject(release)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err := release.Insert(); err != nil {
		cleanupPromotedClientReleaseFinal(promotion)
		common.ApiError(c, err)
		return
	}
	cleanupPromotedClientReleaseTemp(promotion)
	common.ApiSuccess(c, release.ToResponse(true, clientReleaseDownloadURL(c, release)))
}

func AdminUpdateClientRelease(c *gin.Context) {
	release, err := clientReleaseByParam(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	var request clientReleaseRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		common.ApiError(c, err)
		return
	}
	release = clientReleaseRequestToModel(request, release)
	promotion, err := service.PromoteClientReleaseObject(release)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	oldObjectKey, err := release.UpdateReturningPreviousObjectKey()
	if err != nil {
		cleanupPromotedClientReleaseFinal(promotion)
		common.ApiError(c, err)
		return
	}
	cleanupPromotedClientReleaseTemp(promotion)
	cleanupClientReleaseObjectIfChanged(oldObjectKey, release.ObjectKey)
	common.ApiSuccess(c, release.ToResponse(true, clientReleaseDownloadURL(c, release)))
}

func AdminDeleteClientRelease(c *gin.Context) {
	release, err := clientReleaseByParam(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.DeleteClientRelease(release); err != nil {
		common.ApiError(c, err)
		return
	}
	cleanupClientReleaseObject(release.ObjectKey)
	common.ApiSuccess(c, nil)
}

func AdminPublishClientRelease(c *gin.Context) {
	updateClientReleasePublishStatus(c, model.ClientReleaseStatusPublished)
}

func AdminUnpublishClientRelease(c *gin.Context) {
	updateClientReleasePublishStatus(c, model.ClientReleaseStatusDraft)
}

func updateClientReleasePublishStatus(c *gin.Context, status int) {
	release, err := clientReleaseByParam(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	release.Status = status
	if err := release.Update(); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, release.ToResponse(true, clientReleaseDownloadURL(c, release)))
}

func clientReleaseRequestToModel(request clientReleaseRequest, existing *model.ClientRelease) *model.ClientRelease {
	release := &model.ClientRelease{}
	if existing != nil {
		copy := *existing
		release = &copy
	}
	release.Version = strings.TrimSpace(request.Version)
	release.Platform = strings.TrimSpace(request.Platform)
	release.Arch = strings.TrimSpace(request.Arch)
	release.Channel = strings.TrimSpace(request.Channel)
	release.FileName = strings.TrimSpace(request.FileName)
	release.ObjectKey = strings.TrimSpace(request.ObjectKey)
	release.Size = request.Size
	release.SHA256 = strings.TrimSpace(request.SHA256)
	release.SHA512 = strings.TrimSpace(request.SHA512)
	release.ReleaseNotes = strings.TrimSpace(request.ReleaseNotes)
	release.MinVersion = strings.TrimSpace(request.MinVersion)
	release.Forced = request.Forced
	if request.Status != nil {
		release.Status = *request.Status
	} else if request.Published {
		release.Status = model.ClientReleaseStatusPublished
	} else {
		release.Status = model.ClientReleaseStatusDraft
	}
	return release
}

func clientReleaseByParam(c *gin.Context) (*model.ClientRelease, error) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		return nil, fmt.Errorf("invalid client release id")
	}
	return model.GetClientReleaseByID(id)
}

func downloadClientReleaseByParam(c *gin.Context, param string) {
	id, err := strconv.Atoi(c.Param(param))
	if err != nil || id <= 0 {
		common.ApiErrorMsg(c, "invalid client release id")
		return
	}
	release, err := model.GetClientReleaseByID(id)
	if err != nil || release.Status != model.ClientReleaseStatusPublished {
		common.ApiErrorMsg(c, "client release not found")
		return
	}
	signedURL, err := service.SignClientReleaseURL(release.ObjectKey, release.FileName)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.Redirect(http.StatusFound, signedURL)
}

func clientReleaseDownloadURL(c *gin.Context, release *model.ClientRelease) string {
	return fmt.Sprintf("%s/api/client-releases/download/%d", requestBaseURL(c), release.Id)
}

func clientReleaseTime(release *model.ClientRelease) time.Time {
	if release.UpdatedTime > 0 {
		return time.Unix(release.UpdatedTime, 0).UTC()
	}
	if release.CreatedTime > 0 {
		return time.Unix(release.CreatedTime, 0).UTC()
	}
	return time.Now().UTC()
}

func cleanupClientReleaseObjectIfChanged(oldObjectKey string, newObjectKey string) {
	if strings.TrimSpace(oldObjectKey) == "" || strings.TrimSpace(oldObjectKey) == strings.TrimSpace(newObjectKey) {
		return
	}
	cleanupClientReleaseObject(oldObjectKey)
}

func cleanupClientReleaseObject(objectKey string) {
	if strings.TrimSpace(objectKey) == "" {
		return
	}
	if err := service.DeleteClientReleaseObject(objectKey); err != nil {
		common.SysLog(fmt.Sprintf("client release OSS object cleanup failed for %s: %v", objectKey, err))
	}
}

func cleanupPromotedClientReleaseFinal(result *service.ClientReleasePromoteResult) {
	if result == nil || !result.Promoted {
		return
	}
	cleanupClientReleaseObject(result.FinalObject)
}

func cleanupPromotedClientReleaseTemp(result *service.ClientReleasePromoteResult) {
	if result == nil || !result.Promoted {
		return
	}
	cleanupClientReleaseObject(result.TempObject)
}

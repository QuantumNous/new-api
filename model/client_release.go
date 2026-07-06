package model

import (
	"errors"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	ClientReleaseStatusDraft     = 0
	ClientReleaseStatusPublished = 1
	clientReleaseKeywordMaxRunes = 128
	defaultClientReleaseChannel  = "stable"
)

var clientReleaseVersionPattern = regexp.MustCompile(`^\d+\.\d+\.\d+$`)

type ClientRelease struct {
	Id           int            `json:"id" gorm:"primaryKey"`
	Version      string         `json:"version" gorm:"size:64;not null;uniqueIndex:uk_client_release_version_target_delete_at,priority:1"`
	Platform     string         `json:"platform" gorm:"size:32;not null;index;uniqueIndex:uk_client_release_version_target_delete_at,priority:2"`
	Arch         string         `json:"arch" gorm:"size:32;not null;index;uniqueIndex:uk_client_release_version_target_delete_at,priority:3"`
	Channel      string         `json:"channel" gorm:"size:32;not null;default:stable;index;uniqueIndex:uk_client_release_version_target_delete_at,priority:4"`
	FileName     string         `json:"fileName" gorm:"size:255;not null"`
	ObjectKey    string         `json:"-" gorm:"column:object_key;type:text;not null"`
	Size         int64          `json:"size" gorm:"bigint;not null;default:0"`
	SHA256       string         `json:"sha256,omitempty" gorm:"size:128"`
	SHA512       string         `json:"sha512,omitempty" gorm:"type:text"`
	ReleaseNotes string         `json:"releaseNotes,omitempty" gorm:"type:text"`
	MinVersion   string         `json:"minVersion,omitempty" gorm:"size:64"`
	Forced       bool           `json:"forced" gorm:"default:false"`
	Status       int            `json:"status" gorm:"default:0;index"`
	CreatedTime  int64          `json:"createdTime" gorm:"bigint"`
	UpdatedTime  int64          `json:"updatedTime" gorm:"bigint"`
	DeletedAt    gorm.DeletedAt `json:"-" gorm:"index;uniqueIndex:uk_client_release_version_target_delete_at,priority:5"`
}

type ClientReleaseResponse struct {
	ID           int    `json:"id"`
	Version      string `json:"version"`
	Platform     string `json:"platform"`
	Arch         string `json:"arch"`
	Channel      string `json:"channel"`
	FileName     string `json:"fileName"`
	ObjectKey    string `json:"objectKey,omitempty"`
	DownloadURL  string `json:"downloadUrl,omitempty"`
	Size         int64  `json:"size"`
	SHA256       string `json:"sha256,omitempty"`
	SHA512       string `json:"sha512,omitempty"`
	ReleaseNotes string `json:"releaseNotes,omitempty"`
	MinVersion   string `json:"minVersion,omitempty"`
	Forced       bool   `json:"forced"`
	Published    bool   `json:"published,omitempty"`
	Status       int    `json:"status,omitempty"`
	CreatedAt    string `json:"createdAt,omitempty"`
	UpdatedAt    string `json:"updatedAt,omitempty"`
}

type ClientReleaseListResponse struct {
	Items []ClientReleaseResponse `json:"items"`
	Total int64                   `json:"total"`
}

func (r *ClientRelease) BeforeSave(tx *gorm.DB) error {
	r.Version = NormalizeClientReleaseVersion(r.Version)
	r.Platform = NormalizeClientReleasePlatform(r.Platform)
	r.Arch = NormalizeClientReleaseArch(r.Arch)
	r.Channel = NormalizeClientReleaseChannel(r.Channel)
	r.FileName = cleanClientReleaseFileName(r.FileName)
	r.ObjectKey = strings.TrimLeft(strings.TrimSpace(r.ObjectKey), "/")
	r.SHA256 = strings.TrimSpace(r.SHA256)
	r.SHA512 = strings.TrimSpace(r.SHA512)
	r.MinVersion = NormalizeClientReleaseVersion(r.MinVersion)
	r.ReleaseNotes = strings.TrimSpace(r.ReleaseNotes)
	if err := ValidateClientRelease(r); err != nil {
		return err
	}
	now := common.GetTimestamp()
	if r.CreatedTime == 0 {
		r.CreatedTime = now
	}
	r.UpdatedTime = now
	return nil
}

func ValidateClientRelease(r *ClientRelease) error {
	if r.Version == "" {
		return errors.New("client release version is required")
	}
	if err := ValidateClientReleaseVersion(r.Version); err != nil {
		return err
	}
	if !IsAllowedClientReleasePlatform(r.Platform) {
		return errors.New("client release platform must be windows, darwin, or linux")
	}
	if !IsAllowedClientReleaseArch(r.Arch) {
		return errors.New("client release arch must be x64, arm64, ia32, or universal")
	}
	if !IsAllowedClientReleaseChannel(r.Channel) {
		return errors.New("client release channel must be stable or beta")
	}
	if r.MinVersion != "" {
		if err := ValidateClientReleaseVersion(r.MinVersion); err != nil {
			return fmt.Errorf("client release min version is invalid: %w", err)
		}
	}
	if r.FileName == "" {
		return errors.New("client release file name is required")
	}
	if r.ObjectKey == "" {
		return errors.New("client release OSS object is required")
	}
	if r.Size <= 0 {
		return errors.New("client release package size is required")
	}
	switch r.Status {
	case ClientReleaseStatusDraft, ClientReleaseStatusPublished:
	default:
		return errors.New("client release status is invalid")
	}
	if r.Status == ClientReleaseStatusPublished && r.SHA512 == "" {
		return errors.New("client release sha512 is required before publishing")
	}
	return nil
}

func NormalizeClientReleaseVersion(value string) string {
	return strings.TrimSpace(value)
}

func ValidateClientReleaseVersion(value string) error {
	value = NormalizeClientReleaseVersion(value)
	if value == "" {
		return errors.New("client release version is required")
	}
	if !clientReleaseVersionPattern.MatchString(value) {
		return errors.New("client release version must use three numeric segments, such as 1.2.3")
	}
	return nil
}

func NormalizeClientReleasePlatform(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	switch value {
	case "win", "win32", "windows":
		return "windows"
	case "mac", "macos", "osx":
		return "darwin"
	default:
		return value
	}
}

func NormalizeClientReleaseArch(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	switch value {
	case "amd64":
		return "x64"
	case "aarch64":
		return "arm64"
	default:
		return value
	}
}

func NormalizeClientReleaseChannel(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	if value == "" {
		return defaultClientReleaseChannel
	}
	return value
}

func IsAllowedClientReleaseChannel(value string) bool {
	switch NormalizeClientReleaseChannel(value) {
	case "stable", "beta":
		return true
	default:
		return false
	}
}

func IsAllowedClientReleasePlatform(value string) bool {
	switch NormalizeClientReleasePlatform(value) {
	case "windows", "darwin", "linux":
		return true
	default:
		return false
	}
}

func clientReleasePlatformAliases(platform string) []string {
	platform = NormalizeClientReleasePlatform(platform)
	if platform == "" {
		return nil
	}
	if platform == "windows" {
		return []string{"windows", "win32"}
	}
	return []string{platform}
}

func IsAllowedClientReleaseArch(value string) bool {
	switch NormalizeClientReleaseArch(value) {
	case "x64", "arm64", "ia32", "universal":
		return true
	default:
		return false
	}
}

func (r *ClientRelease) Insert() error {
	return DB.Create(r).Error
}

func (r *ClientRelease) Update() error {
	return DB.Save(r).Error
}

func (r *ClientRelease) UpdateReturningPreviousObjectKey() (string, error) {
	var previousObjectKey string
	err := DB.Transaction(func(tx *gorm.DB) error {
		var current ClientRelease
		query := tx
		if !common.UsingSQLite {
			query = query.Clauses(clause.Locking{Strength: "UPDATE"})
		}
		if err := query.Where("id = ?", r.Id).First(&current).Error; err != nil {
			return err
		}
		previousObjectKey = current.ObjectKey
		r.CreatedTime = current.CreatedTime
		return tx.Save(r).Error
	})
	return previousObjectKey, err
}

func DeleteClientRelease(release *ClientRelease) error {
	return DB.Delete(release).Error
}

func GetClientReleaseByID(id int) (*ClientRelease, error) {
	var release ClientRelease
	err := DB.Where("id = ?", id).First(&release).Error
	if err != nil {
		return nil, err
	}
	return &release, nil
}

func SearchClientReleases(keyword string, platform string, arch string, channel string, admin bool, offset int, limit int) ([]*ClientRelease, int64, error) {
	db := DB.Model(&ClientRelease{})
	if !admin {
		db = db.Where("status = ?", ClientReleaseStatusPublished)
	}
	if platform = NormalizeClientReleasePlatform(platform); platform != "" {
		db = db.Where("platform IN ?", clientReleasePlatformAliases(platform))
	}
	if arch = NormalizeClientReleaseArch(arch); arch != "" {
		db = db.Where("arch = ?", arch)
	}
	if channel = strings.TrimSpace(channel); channel != "" {
		db = db.Where("channel = ?", NormalizeClientReleaseChannel(channel))
	}
	like, err := clientReleaseContainsLikePattern(keyword)
	if err != nil {
		return nil, 0, err
	}
	if like != "" {
		db = db.Where(
			"(version LIKE ? ESCAPE '!' OR file_name LIKE ? ESCAPE '!' OR channel LIKE ? ESCAPE '!' OR release_notes LIKE ? ESCAPE '!')",
			like,
			like,
			like,
			like,
		)
	}
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var releases []*ClientRelease
	err = db.Order("id DESC").Offset(offset).Limit(limit).Find(&releases).Error
	return releases, total, err
}

func GetLatestClientRelease(platform string, arch string, channel string) (*ClientRelease, error) {
	platform = NormalizeClientReleasePlatform(platform)
	arch = NormalizeClientReleaseArch(arch)
	channel = NormalizeClientReleaseChannel(channel)
	if !IsAllowedClientReleasePlatform(platform) || !IsAllowedClientReleaseArch(arch) {
		return nil, errors.New("client release platform or arch is invalid")
	}
	if !IsAllowedClientReleaseChannel(channel) {
		return nil, errors.New("client release channel must be stable or beta")
	}
	var release ClientRelease
	err := DB.Where(
		"platform IN ? AND arch = ? AND channel = ? AND status = ?",
		clientReleasePlatformAliases(platform),
		arch,
		channel,
		ClientReleaseStatusPublished,
	).Order("id DESC").First(&release).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &release, nil
}

func ClientReleasesToResponses(releases []*ClientRelease, admin bool, downloadURL func(*ClientRelease) string) []ClientReleaseResponse {
	responses := make([]ClientReleaseResponse, 0, len(releases))
	for _, release := range releases {
		url := ""
		if downloadURL != nil {
			url = downloadURL(release)
		}
		responses = append(responses, release.ToResponse(admin, url))
	}
	return responses
}

func (r *ClientRelease) ToResponse(admin bool, downloadURL string) ClientReleaseResponse {
	response := ClientReleaseResponse{
		ID:           r.Id,
		Version:      r.Version,
		Platform:     NormalizeClientReleasePlatform(r.Platform),
		Arch:         r.Arch,
		Channel:      r.Channel,
		FileName:     r.FileName,
		ObjectKey:    r.ObjectKey,
		DownloadURL:  downloadURL,
		Size:         r.Size,
		SHA256:       r.SHA256,
		SHA512:       r.SHA512,
		ReleaseNotes: r.ReleaseNotes,
		MinVersion:   r.MinVersion,
		Forced:       r.Forced,
		Published:    r.Status == ClientReleaseStatusPublished,
		Status:       r.Status,
	}
	if r.CreatedTime > 0 {
		response.CreatedAt = time.Unix(r.CreatedTime, 0).UTC().Format(time.RFC3339)
	}
	if r.UpdatedTime > 0 {
		response.UpdatedAt = time.Unix(r.UpdatedTime, 0).UTC().Format(time.RFC3339)
	}
	if !admin {
		response.ObjectKey = ""
		response.Status = 0
		response.Published = false
	}
	return response
}

func CompareClientVersions(left string, right string) int {
	leftVersion := parseClientVersion(left)
	rightVersion := parseClientVersion(right)
	for i := 0; i < 3; i++ {
		if leftVersion.parts[i] > rightVersion.parts[i] {
			return 1
		}
		if leftVersion.parts[i] < rightVersion.parts[i] {
			return -1
		}
	}
	if leftVersion.preRelease == rightVersion.preRelease {
		return 0
	}
	if leftVersion.preRelease == "" {
		return 1
	}
	if rightVersion.preRelease == "" {
		return -1
	}
	if leftVersion.preRelease > rightVersion.preRelease {
		return 1
	}
	return -1
}

type parsedClientVersion struct {
	parts      [3]int
	preRelease string
}

func parseClientVersion(value string) parsedClientVersion {
	value = strings.TrimSpace(value)
	value = strings.TrimPrefix(value, "v")
	value = strings.TrimPrefix(value, "V")
	if idx := strings.Index(value, "+"); idx >= 0 {
		value = value[:idx]
	}
	preRelease := ""
	if idx := strings.Index(value, "-"); idx >= 0 {
		preRelease = value[idx+1:]
		value = value[:idx]
	}
	var result parsedClientVersion
	result.preRelease = preRelease
	segments := strings.Split(value, ".")
	for i := 0; i < len(segments) && i < 3; i++ {
		part := numericPrefix(segments[i])
		if part == "" {
			continue
		}
		num, err := strconv.Atoi(part)
		if err == nil {
			result.parts[i] = num
		}
	}
	return result
}

func numericPrefix(value string) string {
	value = strings.TrimSpace(value)
	var builder strings.Builder
	for _, r := range value {
		if r < '0' || r > '9' {
			break
		}
		builder.WriteRune(r)
	}
	return builder.String()
}

func clientReleaseContainsLikePattern(value string) (string, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return "", nil
	}
	if len([]rune(value)) > clientReleaseKeywordMaxRunes {
		return "", errors.New("keyword is too long")
	}
	value = strings.ReplaceAll(value, "!", "!!")
	value = strings.ReplaceAll(value, "%", "!%")
	value = strings.ReplaceAll(value, "_", "!_")
	return "%" + value + "%", nil
}

func cleanClientReleaseFileName(value string) string {
	value = strings.TrimSpace(value)
	value = strings.ReplaceAll(value, "\\", "/")
	parts := strings.Split(value, "/")
	if len(parts) > 0 {
		value = parts[len(parts)-1]
	}
	value = strings.Trim(value, ". ")
	if len(value) > 255 {
		return value[len(value)-255:]
	}
	return value
}

func ClientReleaseTarget(platform string, arch string, channel string) string {
	return fmt.Sprintf(
		"%s/%s/%s",
		NormalizeClientReleasePlatform(platform),
		NormalizeClientReleaseArch(arch),
		NormalizeClientReleaseChannel(channel),
	)
}

package service

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/url"
	"os"
	"path"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/aliyun/aliyun-oss-go-sdk/oss"
)

const SkillHubZipMaxBytes = 50 << 20
const SkillHubIconMaxBytes = 1 << 20
const defaultSkillHubUploadURLExpiresSeconds int64 = 3600
const skillHubTempDir = "_tmp"

const (
	SkillHubUploadKindZip  = "zip"
	SkillHubUploadKindIcon = "icon"
)

var skillHubObjectSafePattern = regexp.MustCompile(`[^A-Za-z0-9._-]+`)

type SkillHubUploadResult struct {
	URL      string `json:"url"`
	Object   string `json:"object"`
	Size     int64  `json:"size"`
	Checksum string `json:"checksum"`
}

type SkillHubDirectUploadInput struct {
	Kind     string
	SkillID  string
	Version  string
	FileName string
	Size     int64
}

type SkillHubDirectUploadInitResult struct {
	Kind          string            `json:"kind"`
	FileName      string            `json:"fileName"`
	Object        string            `json:"object"`
	Size          int64             `json:"size"`
	ContentType   string            `json:"contentType"`
	UploadURL     string            `json:"uploadUrl"`
	UploadMethod  string            `json:"uploadMethod"`
	UploadHeaders map[string]string `json:"uploadHeaders"`
	UploadTicket  string            `json:"uploadTicket"`
	ExpiresAt     int64             `json:"expiresAt"`
}

type SkillHubDirectUploadCompleteResult struct {
	Kind    string
	SkillID string
	Upload  *SkillHubUploadResult
}

type SkillHubPromoteResult struct {
	ZipPromoted     bool
	IconPromoted    bool
	TempSourceRef   string
	FinalSourceRef  string
	TempIconObject  string
	FinalIconObject string
}

type skillHubOSSConfig struct {
	Endpoint        string
	Bucket          string
	AccessKeyID     string
	AccessKeySecret string
	Prefix          string
}

type skillHubIconOSSConfig struct {
	skillHubOSSConfig
	PublicBaseURL string
}

type skillHubUploadTicket struct {
	Kind        string `json:"kind"`
	SkillID     string `json:"skillId"`
	FileName    string `json:"fileName"`
	Object      string `json:"object"`
	Size        int64  `json:"size"`
	ContentType string `json:"contentType"`
	ExpiresAt   int64  `json:"expiresAt"`
}

func InitSkillHubDirectUpload(input SkillHubDirectUploadInput) (*SkillHubDirectUploadInitResult, error) {
	input.Kind = normalizeSkillHubUploadKind(input.Kind)
	if input.Kind == "" {
		return nil, errors.New("skill hub upload kind must be zip or icon")
	}
	if strings.TrimSpace(input.SkillID) == "" {
		return nil, errors.New("skill id is required before upload")
	}
	if strings.TrimSpace(input.FileName) == "" {
		return nil, errors.New("upload file name is required")
	}
	if input.Size <= 0 {
		return nil, errors.New("upload file is empty")
	}

	cfg, publicBaseURL, contentType, objectKey, err := skillHubDirectUploadConfig(input)
	if err != nil {
		return nil, err
	}
	bucket, err := cfg.bucket()
	if err != nil {
		return nil, err
	}

	expires := skillHubUploadURLExpires()
	uploadURL, err := bucket.SignURL(objectKey, oss.HTTPPut, expires, oss.ContentType(contentType))
	if err != nil {
		return nil, err
	}
	ticket := skillHubUploadTicket{
		Kind:        input.Kind,
		SkillID:     strings.TrimSpace(input.SkillID),
		FileName:    cleanSkillHubUploadFileName(input.FileName),
		Object:      objectKey,
		Size:        input.Size,
		ContentType: contentType,
		ExpiresAt:   time.Now().Unix() + expires,
	}
	if input.Kind == SkillHubUploadKindIcon {
		if strings.TrimSpace(publicBaseURL) == "" {
			return nil, errors.New("skill hub icon public base url is not configured")
		}
		if err := validateSkillHubIconPublicBaseURL(publicBaseURL); err != nil {
			return nil, err
		}
	}
	uploadTicket, err := signSkillHubUploadTicket(ticket, cfg)
	if err != nil {
		return nil, err
	}

	return &SkillHubDirectUploadInitResult{
		Kind:         input.Kind,
		FileName:     ticket.FileName,
		Object:       objectKey,
		Size:         input.Size,
		ContentType:  contentType,
		UploadURL:    uploadURL,
		UploadMethod: string(oss.HTTPPut),
		UploadHeaders: map[string]string{
			"Content-Type": contentType,
		},
		UploadTicket: uploadTicket,
		ExpiresAt:    ticket.ExpiresAt,
	}, nil
}

func CompleteSkillHubDirectUpload(uploadTicket string) (*SkillHubDirectUploadCompleteResult, error) {
	ticket, cfg, err := parseSkillHubUploadTicket(uploadTicket)
	if err != nil {
		return nil, err
	}
	if ticket.ExpiresAt <= time.Now().Unix() {
		return nil, errors.New("skill hub upload ticket has expired")
	}
	if ticket.Object == "" || ticket.SkillID == "" || ticket.Size <= 0 {
		return nil, errors.New("skill hub upload ticket is invalid")
	}
	if !cfg.isTempObjectKey(ticket.Object) {
		return nil, errors.New("skill hub upload ticket object is not temporary")
	}
	bucket, err := cfg.bucket()
	if err != nil {
		return nil, err
	}
	meta, err := bucket.GetObjectDetailedMeta(ticket.Object)
	if err != nil {
		return nil, err
	}
	if size, err := strconv.ParseInt(meta.Get("Content-Length"), 10, 64); err != nil || size != ticket.Size {
		_ = bucket.DeleteObject(ticket.Object)
		return nil, errors.New("skill hub uploaded object size does not match")
	}
	if ticket.Size > skillHubUploadMaxBytes(ticket.Kind) {
		_ = bucket.DeleteObject(ticket.Object)
		return nil, fmt.Errorf("skill hub upload must be <= %d MB", skillHubUploadMaxBytes(ticket.Kind)>>20)
	}

	size, checksum, header, err := hashSkillHubObject(bucket, ticket.Object, skillHubUploadMaxBytes(ticket.Kind))
	if err != nil {
		return nil, err
	}
	if size != ticket.Size {
		_ = bucket.DeleteObject(ticket.Object)
		return nil, errors.New("skill hub uploaded object size does not match")
	}
	if err := validateSkillHubUploadedHeader(ticket, header); err != nil {
		_ = bucket.DeleteObject(ticket.Object)
		return nil, err
	}

	result := &SkillHubUploadResult{
		Object:   ticket.Object,
		Size:     size,
		Checksum: checksum,
	}
	if ticket.Kind == SkillHubUploadKindIcon {
		cfg := loadSkillHubIconOSSConfig()
		if strings.TrimSpace(cfg.PublicBaseURL) == "" {
			return nil, errors.New("skill hub icon public base url is not configured")
		}
		if err := validateSkillHubIconPublicBaseURL(cfg.PublicBaseURL); err != nil {
			return nil, err
		}
		result.URL = objectPublicURL(cfg.PublicBaseURL, ticket.Object)
	}
	return &SkillHubDirectUploadCompleteResult{
		Kind:    ticket.Kind,
		SkillID: ticket.SkillID,
		Upload:  result,
	}, nil
}

func DiscardSkillHubDirectUpload(uploadTicket string) error {
	ticket, cfg, err := parseSkillHubUploadTicket(uploadTicket)
	if err != nil {
		return err
	}
	objectKey, ok := cfg.managedObjectKey(ticket.Object)
	if !ok {
		return nil
	}
	if !cfg.isTempObjectKey(objectKey) {
		return errors.New("skill hub upload ticket object is not temporary")
	}
	bucket, err := cfg.bucket()
	if err != nil {
		return err
	}
	return bucket.DeleteObject(objectKey)
}

func DeleteSkillHubZipObject(objectKey string) error {
	cfg := loadSkillHubOSSConfig()
	objectKey, ok := cfg.managedObjectKey(objectKey)
	if !ok {
		return nil
	}
	if err := cfg.validate(); err != nil {
		return err
	}
	bucket, err := cfg.bucket()
	if err != nil {
		return err
	}
	return bucket.DeleteObject(objectKey)
}

func DeleteSkillHubIconByURL(value string) error {
	cfg := loadSkillHubIconOSSConfig()
	if strings.TrimSpace(cfg.PublicBaseURL) == "" {
		return nil
	}
	objectKey, ok := cfg.objectKeyFromPublicURL(value)
	if !ok {
		return nil
	}
	if err := cfg.validate(); err != nil {
		return err
	}
	bucket, err := cfg.bucket()
	if err != nil {
		return err
	}
	return bucket.DeleteObject(objectKey)
}

func DeleteSkillHubIconObject(objectKey string) error {
	cfg := loadSkillHubIconOSSConfig()
	objectKey, ok := cfg.managedObjectKey(objectKey)
	if !ok {
		return nil
	}
	if err := cfg.validate(); err != nil {
		return err
	}
	bucket, err := cfg.bucket()
	if err != nil {
		return err
	}
	return bucket.DeleteObject(objectKey)
}

func OpenSkillHubZipObject(objectKey string) (io.ReadCloser, error) {
	cfg := loadSkillHubOSSConfig()
	objectKey, ok := cfg.managedObjectKey(objectKey)
	if !ok || cfg.isTempObjectKey(objectKey) {
		return nil, errors.New("skill hub source object is not managed")
	}
	if err := cfg.validate(); err != nil {
		return nil, err
	}
	bucket, err := cfg.bucket()
	if err != nil {
		return nil, err
	}
	return bucket.GetObject(objectKey)
}

func OpenSkillHubIconObject(iconURL string) (io.ReadCloser, string, error) {
	cfg := loadSkillHubIconOSSConfig()
	objectKey, ok := cfg.objectKeyFromPublicURL(iconURL)
	if !ok || cfg.isTempObjectKey(objectKey) {
		return nil, "", errors.New("skill hub icon object is not managed")
	}
	ext := strings.ToLower(path.Ext(objectKey))
	if ext == ".jpeg" {
		ext = ".jpg"
	}
	if ext != ".png" && ext != ".jpg" && ext != ".webp" {
		return nil, "", errors.New("skill hub icon object extension is invalid")
	}
	if err := cfg.validate(); err != nil {
		return nil, "", err
	}
	bucket, err := cfg.bucket()
	if err != nil {
		return nil, "", err
	}
	reader, err := bucket.GetObject(objectKey)
	return reader, ext, err
}

func PromoteSkillHubObjects(skill *model.SkillHubSkill) (*SkillHubPromoteResult, error) {
	result := &SkillHubPromoteResult{}
	if err := promoteSkillHubZipObject(skill, result); err != nil {
		return nil, err
	}
	if err := promoteSkillHubIconObject(skill, result); err != nil {
		if result.ZipPromoted {
			_ = DeleteSkillHubZipObject(result.FinalSourceRef)
		}
		return nil, err
	}
	return result, nil
}

func promoteSkillHubZipObject(skill *model.SkillHubSkill, result *SkillHubPromoteResult) error {
	cfg := loadSkillHubOSSConfig()
	objectKey, ok := cfg.managedObjectKey(skill.SourceRef)
	if strings.TrimSpace(skill.SourceRef) == "" {
		return nil
	}
	if !ok {
		return errors.New("skill hub source object is outside the managed prefix")
	}
	skill.SourceRef = objectKey
	if !cfg.isTempObjectKey(objectKey) {
		return nil
	}
	if err := cfg.validate(); err != nil {
		return err
	}
	finalObject := cfg.objectKey(skill.SkillID, skill.Version, path.Base(objectKey))
	if cfg.isTempObjectKey(finalObject) || finalObject == objectKey {
		return errors.New("skill hub final source object is invalid")
	}
	bucket, err := cfg.bucket()
	if err != nil {
		return err
	}
	if _, err := bucket.CopyObject(objectKey, finalObject, oss.ForbidOverWrite(true)); err != nil {
		return err
	}
	skill.SourceRef = finalObject
	result.ZipPromoted = true
	result.TempSourceRef = objectKey
	result.FinalSourceRef = finalObject
	return nil
}

func promoteSkillHubIconObject(skill *model.SkillHubSkill, result *SkillHubPromoteResult) error {
	cfg := loadSkillHubIconOSSConfig()
	if strings.TrimSpace(skill.Icon) == "" {
		return nil
	}
	objectKey, ok := cfg.objectKeyFromPublicURL(skill.Icon)
	if !ok {
		return nil
	}
	if !cfg.isTempObjectKey(objectKey) {
		return nil
	}
	if err := cfg.validate(); err != nil {
		return err
	}
	if strings.TrimSpace(cfg.PublicBaseURL) == "" {
		return errors.New("skill hub icon public base url is not configured")
	}
	ext := strings.ToLower(path.Ext(objectKey))
	if ext == ".jpeg" {
		ext = ".jpg"
	}
	if ext != ".png" && ext != ".jpg" && ext != ".webp" {
		return errors.New("skill hub icon object extension is invalid")
	}
	finalObject := cfg.iconObjectKey(skill.SkillID, path.Base(objectKey), ext)
	if cfg.isTempObjectKey(finalObject) || finalObject == objectKey {
		return errors.New("skill hub final icon object is invalid")
	}
	bucket, err := cfg.bucket()
	if err != nil {
		return err
	}
	if _, err := bucket.CopyObject(objectKey, finalObject, oss.ForbidOverWrite(true)); err != nil {
		return err
	}
	skill.Icon = objectPublicURL(cfg.PublicBaseURL, finalObject)
	result.IconPromoted = true
	result.TempIconObject = objectKey
	result.FinalIconObject = finalObject
	return nil
}

func loadSkillHubOSSConfig() skillHubOSSConfig {
	return skillHubOSSConfig{
		Endpoint:        strings.TrimSpace(os.Getenv("SKILL_HUB_OSS_ENDPOINT")),
		Bucket:          strings.TrimSpace(os.Getenv("SKILL_HUB_OSS_BUCKET")),
		AccessKeyID:     strings.TrimSpace(os.Getenv("SKILL_HUB_OSS_ACCESS_KEY_ID")),
		AccessKeySecret: strings.TrimSpace(os.Getenv("SKILL_HUB_OSS_ACCESS_KEY_SECRET")),
		Prefix:          strings.TrimSpace(os.Getenv("SKILL_HUB_OSS_PREFIX")),
	}
}

func loadSkillHubIconOSSConfig() skillHubIconOSSConfig {
	base := loadSkillHubOSSConfig()
	cfg := skillHubIconOSSConfig{
		skillHubOSSConfig: skillHubOSSConfig{
			Endpoint:        firstEnv("SKILL_HUB_OSS_ICON_ENDPOINT", base.Endpoint),
			Bucket:          firstEnv("SKILL_HUB_OSS_ICON_BUCKET", base.Bucket),
			AccessKeyID:     firstEnv("SKILL_HUB_OSS_ICON_ACCESS_KEY_ID", base.AccessKeyID),
			AccessKeySecret: firstEnv("SKILL_HUB_OSS_ICON_ACCESS_KEY_SECRET", base.AccessKeySecret),
			Prefix:          firstEnv("SKILL_HUB_OSS_ICON_PREFIX", "skill-hub/icons"),
		},
		PublicBaseURL: strings.TrimRight(strings.TrimSpace(os.Getenv("SKILL_HUB_OSS_ICON_PUBLIC_BASE_URL")), "/"),
	}
	return cfg
}

func firstEnv(key string, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}
	return strings.TrimSpace(fallback)
}

func (c skillHubOSSConfig) validate() error {
	if c.Endpoint == "" || c.Bucket == "" || c.AccessKeyID == "" || c.AccessKeySecret == "" {
		return errors.New("skill hub oss is not configured")
	}
	return nil
}

func (c skillHubOSSConfig) bucket() (*oss.Bucket, error) {
	client, err := oss.New(normalizeOSSEndpoint(c.Endpoint), c.AccessKeyID, c.AccessKeySecret)
	if err != nil {
		return nil, err
	}
	return client.Bucket(c.Bucket)
}

func (c skillHubOSSConfig) objectKey(skillID string, version string, filename string) string {
	id := cleanObjectPart(skillID)
	if id == "" {
		id = "draft"
	}
	ver := cleanObjectPart(version)
	if ver == "" {
		ver = time.Now().UTC().Format("20060102150405")
	}
	name := cleanObjectPart(strings.TrimSuffix(path.Base(strings.ReplaceAll(filename, "\\", "/")), ".zip"))
	if name == "" {
		name = id
	}
	stamp := time.Now().UTC().Format("20060102150405.000000000")
	return path.Join(c.basePrefix(), id, fmt.Sprintf("%s-%s-%s.zip", name, ver, stamp))
}

func (c skillHubOSSConfig) tempObjectKey(kind string, skillID string, filename string) (string, error) {
	id := cleanObjectPart(skillID)
	if id == "" {
		id = "draft"
	}
	objectID, err := randomOSSObjectID()
	if err != nil {
		return "", err
	}
	name := cleanSkillHubUploadFileName(filename)
	if name == "" {
		name = "upload"
	}
	return path.Join(c.basePrefix(), skillHubTempDir, kind, id, objectID, name), nil
}

func (c skillHubIconOSSConfig) iconObjectKey(skillID string, filename string, ext string) string {
	id := cleanObjectPart(skillID)
	if id == "" {
		id = "draft"
	}
	name := cleanObjectPart(strings.TrimSuffix(path.Base(strings.ReplaceAll(filename, "\\", "/")), path.Ext(filename)))
	if name == "" {
		name = "icon"
	}
	stamp := time.Now().UTC().Format("20060102150405.000000000")
	return path.Join(c.basePrefix(), id, fmt.Sprintf("%s-%s%s", name, stamp, ext))
}

func (c skillHubOSSConfig) managedObjectKey(objectKey string) (string, bool) {
	objectKey = strings.TrimLeft(strings.TrimSpace(objectKey), "/")
	if objectKey == "" {
		return "", false
	}
	prefix := c.basePrefix()
	return objectKey, objectKey == prefix || strings.HasPrefix(objectKey, prefix+"/")
}

func (c skillHubOSSConfig) isTempObjectKey(objectKey string) bool {
	objectKey = strings.TrimLeft(strings.TrimSpace(objectKey), "/")
	tempPrefix := path.Join(c.basePrefix(), skillHubTempDir)
	return objectKey == tempPrefix || strings.HasPrefix(objectKey, tempPrefix+"/")
}

func (c skillHubOSSConfig) basePrefix() string {
	prefix := strings.Trim(strings.TrimSpace(c.Prefix), "/")
	if prefix == "" {
		prefix = "skill-hub/skills"
	}
	return prefix
}

func (c skillHubIconOSSConfig) objectKeyFromPublicURL(value string) (string, bool) {
	value = strings.TrimSpace(value)
	if value == "" || strings.TrimSpace(c.PublicBaseURL) == "" {
		return "", false
	}
	base, err := url.Parse(strings.TrimRight(strings.TrimSpace(c.PublicBaseURL), "/"))
	if err != nil || base.Scheme != "https" || base.Host == "" || base.User != nil {
		return "", false
	}
	parsed, err := url.Parse(value)
	if err != nil || parsed.Scheme != "https" || parsed.Host == "" || parsed.User != nil {
		return "", false
	}
	if parsed.RawQuery != "" || parsed.Fragment != "" || !strings.EqualFold(parsed.Host, base.Host) {
		return "", false
	}
	basePath := strings.TrimRight(base.EscapedPath(), "/")
	targetPath := parsed.EscapedPath()
	if basePath != "" {
		if targetPath == basePath || !strings.HasPrefix(targetPath, basePath+"/") {
			return "", false
		}
		targetPath = strings.TrimPrefix(targetPath, basePath+"/")
	} else {
		targetPath = strings.TrimLeft(targetPath, "/")
	}
	objectKey, err := url.PathUnescape(targetPath)
	if err != nil {
		return "", false
	}
	return c.managedObjectKey(objectKey)
}

func objectPublicURL(baseURL string, objectKey string) string {
	baseURL = strings.TrimRight(strings.TrimSpace(baseURL), "/")
	parts := strings.Split(strings.TrimLeft(strings.TrimSpace(objectKey), "/"), "/")
	escaped := make([]string, 0, len(parts))
	for _, part := range parts {
		if part == "" {
			continue
		}
		escaped = append(escaped, url.PathEscape(part))
	}
	return baseURL + "/" + strings.Join(escaped, "/")
}

func validateSkillHubIconPublicBaseURL(value string) error {
	parsed, err := url.Parse(strings.TrimSpace(value))
	if err != nil || parsed.Scheme != "https" || parsed.Host == "" || parsed.User != nil {
		return errors.New("skill hub icon public base url must be an https url")
	}
	if parsed.RawQuery != "" || parsed.Fragment != "" {
		return errors.New("skill hub icon public base url must not include query or fragment")
	}
	return nil
}

func SignSkillHubZipURL(objectKey string, filename string) (string, error) {
	cfg := loadSkillHubOSSConfig()
	if err := cfg.validate(); err != nil {
		return "", err
	}
	var ok bool
	objectKey, ok = cfg.managedObjectKey(objectKey)
	if !ok {
		return "", errors.New("skill hub oss object is required")
	}
	if cfg.isTempObjectKey(objectKey) {
		return "", errors.New("skill hub oss object is not finalized")
	}
	bucket, err := cfg.bucket()
	if err != nil {
		return "", err
	}
	expires := skillHubSignedURLExpires()
	options := []oss.Option{}
	if strings.TrimSpace(filename) != "" {
		options = append(options, oss.ResponseContentDisposition(
			fmt.Sprintf("attachment; filename=%q", cleanObjectPart(filename)+".zip"),
		))
	}
	return bucket.SignURL(objectKey, oss.HTTPGet, expires, options...)
}

func skillHubSignedURLExpires() int64 {
	value := strings.TrimSpace(os.Getenv("SKILL_HUB_OSS_SIGNED_URL_EXPIRES_SECONDS"))
	if value == "" {
		return 600
	}
	seconds, err := strconv.ParseInt(value, 10, 64)
	if err != nil || seconds <= 0 {
		return 600
	}
	if seconds > 86400 {
		return 86400
	}
	return seconds
}

func cleanObjectPart(value string) string {
	value = strings.TrimSpace(value)
	value = skillHubObjectSafePattern.ReplaceAllString(value, "-")
	value = strings.Trim(value, ".-_")
	if len(value) > 80 {
		value = value[:80]
	}
	return value
}

func normalizeSkillHubUploadKind(kind string) string {
	switch strings.ToLower(strings.TrimSpace(kind)) {
	case SkillHubUploadKindZip:
		return SkillHubUploadKindZip
	case SkillHubUploadKindIcon:
		return SkillHubUploadKindIcon
	default:
		return ""
	}
}

func skillHubDirectUploadConfig(input SkillHubDirectUploadInput) (skillHubOSSConfig, string, string, string, error) {
	switch input.Kind {
	case SkillHubUploadKindZip:
		if input.Size > SkillHubZipMaxBytes {
			return skillHubOSSConfig{}, "", "", "", fmt.Errorf("zip file must be <= %d MB", SkillHubZipMaxBytes>>20)
		}
		contentType, err := skillHubZipContentType(input.FileName)
		if err != nil {
			return skillHubOSSConfig{}, "", "", "", err
		}
		cfg := loadSkillHubOSSConfig()
		if err := cfg.validate(); err != nil {
			return skillHubOSSConfig{}, "", "", "", err
		}
		objectKey, err := cfg.tempObjectKey("packages", input.SkillID, input.FileName)
		if err != nil {
			return skillHubOSSConfig{}, "", "", "", err
		}
		return cfg, "", contentType, objectKey, nil
	case SkillHubUploadKindIcon:
		if input.Size > SkillHubIconMaxBytes {
			return skillHubOSSConfig{}, "", "", "", fmt.Errorf("icon file must be <= %d MB", SkillHubIconMaxBytes>>20)
		}
		contentType, _, err := skillHubIconContentType(input.FileName)
		if err != nil {
			return skillHubOSSConfig{}, "", "", "", err
		}
		cfg := loadSkillHubIconOSSConfig()
		if err := cfg.validate(); err != nil {
			return skillHubOSSConfig{}, "", "", "", err
		}
		objectKey, err := cfg.tempObjectKey("icons", input.SkillID, input.FileName)
		if err != nil {
			return skillHubOSSConfig{}, "", "", "", err
		}
		return cfg.skillHubOSSConfig, cfg.PublicBaseURL, contentType, objectKey, nil
	default:
		return skillHubOSSConfig{}, "", "", "", errors.New("skill hub upload kind must be zip or icon")
	}
}

func skillHubZipContentType(filename string) (string, error) {
	if strings.ToLower(path.Ext(strings.ReplaceAll(filename, "\\", "/"))) != ".zip" {
		return "", errors.New("only .zip files are supported")
	}
	return "application/zip", nil
}

func skillHubIconContentType(filename string) (string, string, error) {
	switch strings.ToLower(path.Ext(strings.ReplaceAll(filename, "\\", "/"))) {
	case ".png":
		return "image/png", ".png", nil
	case ".jpg", ".jpeg":
		return "image/jpeg", ".jpg", nil
	case ".webp":
		return "image/webp", ".webp", nil
	default:
		return "", "", errors.New("only png, jpg, jpeg, and webp icons are supported")
	}
}

func cleanSkillHubUploadFileName(value string) string {
	value = strings.TrimSpace(value)
	value = strings.ReplaceAll(value, "\\", "/")
	value = path.Base(value)
	value = strings.Trim(value, ". ")
	if value == "." || value == "/" {
		return ""
	}
	if len(value) > 255 {
		return value[len(value)-255:]
	}
	return value
}

func skillHubUploadMaxBytes(kind string) int64 {
	if kind == SkillHubUploadKindIcon {
		return SkillHubIconMaxBytes
	}
	return SkillHubZipMaxBytes
}

func skillHubUploadURLExpires() int64 {
	value := strings.TrimSpace(os.Getenv("SKILL_HUB_OSS_UPLOAD_URL_EXPIRES_SECONDS"))
	if value == "" {
		return defaultSkillHubUploadURLExpiresSeconds
	}
	seconds, err := strconv.ParseInt(value, 10, 64)
	if err != nil || seconds <= 0 {
		return defaultSkillHubUploadURLExpiresSeconds
	}
	if seconds > 86400 {
		return 86400
	}
	return seconds
}

func signSkillHubUploadTicket(ticket skillHubUploadTicket, cfg skillHubOSSConfig) (string, error) {
	payload, err := common.Marshal(ticket)
	if err != nil {
		return "", err
	}
	encodedPayload := base64.RawURLEncoding.EncodeToString(payload)
	signature := signSkillHubUploadPayload(encodedPayload, cfg)
	return encodedPayload + "." + signature, nil
}

func parseSkillHubUploadTicket(value string) (*skillHubUploadTicket, skillHubOSSConfig, error) {
	payload, signature, ok := strings.Cut(strings.TrimSpace(value), ".")
	if !ok || payload == "" || signature == "" {
		return nil, skillHubOSSConfig{}, errors.New("skill hub upload ticket is invalid")
	}
	data, err := base64.RawURLEncoding.DecodeString(payload)
	if err != nil {
		return nil, skillHubOSSConfig{}, errors.New("skill hub upload ticket is invalid")
	}
	var ticket skillHubUploadTicket
	if err := common.Unmarshal(data, &ticket); err != nil {
		return nil, skillHubOSSConfig{}, errors.New("skill hub upload ticket is invalid")
	}
	ticket.Kind = normalizeSkillHubUploadKind(ticket.Kind)
	cfg, err := skillHubUploadConfigForKind(ticket.Kind)
	if err != nil {
		return nil, skillHubOSSConfig{}, err
	}
	expected := signSkillHubUploadPayload(payload, cfg)
	if !hmac.Equal([]byte(signature), []byte(expected)) {
		return nil, skillHubOSSConfig{}, errors.New("skill hub upload ticket is invalid")
	}
	ticket.SkillID = strings.TrimSpace(ticket.SkillID)
	ticket.FileName = cleanSkillHubUploadFileName(ticket.FileName)
	ticket.ContentType = strings.TrimSpace(ticket.ContentType)
	objectKey, ok := cfg.managedObjectKey(ticket.Object)
	if !ok || ticket.SkillID == "" || ticket.FileName == "" || ticket.ContentType == "" {
		return nil, skillHubOSSConfig{}, errors.New("skill hub upload ticket is invalid")
	}
	ticket.Object = objectKey
	return &ticket, cfg, nil
}

func skillHubUploadConfigForKind(kind string) (skillHubOSSConfig, error) {
	switch normalizeSkillHubUploadKind(kind) {
	case SkillHubUploadKindZip:
		cfg := loadSkillHubOSSConfig()
		return cfg, cfg.validate()
	case SkillHubUploadKindIcon:
		cfg := loadSkillHubIconOSSConfig()
		return cfg.skillHubOSSConfig, cfg.validate()
	default:
		return skillHubOSSConfig{}, errors.New("skill hub upload ticket is invalid")
	}
}

func signSkillHubUploadPayload(payload string, cfg skillHubOSSConfig) string {
	secret := strings.TrimSpace(os.Getenv("SKILL_HUB_OSS_UPLOAD_TICKET_SECRET"))
	if secret == "" {
		secret = cfg.AccessKeySecret
	}
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(payload))
	return base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

func hashSkillHubObject(bucket *oss.Bucket, objectKey string, maxBytes int64) (int64, string, []byte, error) {
	reader, err := bucket.GetObject(objectKey)
	if err != nil {
		return 0, "", nil, err
	}
	defer reader.Close()

	hasher := sha256.New()
	header := make([]byte, 0, 512)
	buffer := make([]byte, 32*1024)
	var size int64
	for {
		n, readErr := reader.Read(buffer)
		if n > 0 {
			chunk := buffer[:n]
			size += int64(n)
			if size > maxBytes {
				return 0, "", nil, fmt.Errorf("skill hub upload must be <= %d MB", maxBytes>>20)
			}
			if len(header) < 512 {
				remaining := 512 - len(header)
				if n < remaining {
					remaining = n
				}
				header = append(header, chunk[:remaining]...)
			}
			if _, err := hasher.Write(chunk); err != nil {
				return 0, "", nil, err
			}
		}
		if readErr == io.EOF {
			break
		}
		if readErr != nil {
			return 0, "", nil, readErr
		}
	}
	return size, "sha256:" + hex.EncodeToString(hasher.Sum(nil)), header, nil
}

func validateSkillHubUploadedHeader(ticket *skillHubUploadTicket, header []byte) error {
	switch ticket.Kind {
	case SkillHubUploadKindZip:
		if !isZipHeader(header) {
			return errors.New("uploaded file is not a zip archive")
		}
	case SkillHubUploadKindIcon:
		contentType, _, err := detectSkillHubIconHeader(header)
		if err != nil {
			return err
		}
		if contentType != ticket.ContentType {
			return errors.New("uploaded icon content does not match the file extension")
		}
	default:
		return errors.New("skill hub upload ticket is invalid")
	}
	return nil
}

func isZipHeader(header []byte) bool {
	return len(header) >= 4 && string(header[:2]) == "PK"
}

func detectSkillHubIconHeader(header []byte) (string, string, error) {
	switch {
	case bytes.HasPrefix(header, []byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n'}):
		return "image/png", ".png", nil
	case len(header) >= 3 && header[0] == 0xff && header[1] == 0xd8 && header[2] == 0xff:
		return "image/jpeg", ".jpg", nil
	case len(header) >= 12 && string(header[:4]) == "RIFF" && string(header[8:12]) == "WEBP":
		return "image/webp", ".webp", nil
	default:
		return "", "", errors.New("only png, jpg, jpeg, and webp icons are supported")
	}
}

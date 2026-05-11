package doubao

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/pkg/errors"
)

const (
	virtualPortraitAPIVersion        = "2024-01-01"
	virtualPortraitDefaultRegion     = "cn-beijing"
	virtualPortraitDefaultProject    = "default"
	virtualPortraitDefaultGroupName  = "默认"
	virtualPortraitGroupTypeAIGC     = "AIGC"
	virtualPortraitAssetTypeImage    = "Image"
	virtualPortraitStatusActive      = "Active"
	virtualPortraitStatusProcessing  = "Processing"
	virtualPortraitStatusFailed      = "Failed"
	virtualPortraitOpenAPIHostFormat = "https://ark.%s.volcengineapi.com"
)

var virtualPortraitPollIntervals = []time.Duration{
	1 * time.Second,
	3 * time.Second,
	7 * time.Second,
}

type virtualPortraitConfig struct {
	AccessKey   string
	SecretKey   string
	Region      string
	ProjectName string
	GroupID     string
	GroupName   string
}

type virtualPortraitClient struct {
	accessKey string
	secretKey string
	region    string
	baseURL   string
	proxy     string
	client    *http.Client
}

type virtualPortraitOpenAPIResponse struct {
	ResponseMetadata struct {
		Error *struct {
			Code    string `json:"Code"`
			Message string `json:"Message"`
		} `json:"Error,omitempty"`
	} `json:"ResponseMetadata"`
	Result struct {
		ID      string `json:"Id"`
		GroupID string `json:"GroupId"`
		AssetID string `json:"AssetId"`
		Name    string `json:"Name"`
		Status  string `json:"Status"`
		Error   *struct {
			Code    string `json:"Code"`
			Message string `json:"Message"`
		} `json:"Error,omitempty"`
		AssetGroups []struct {
			ID      string `json:"Id"`
			GroupID string `json:"GroupId"`
			Name    string `json:"Name"`
		} `json:"AssetGroups,omitempty"`
		List []struct {
			ID      string `json:"Id"`
			GroupID string `json:"GroupId"`
			Name    string `json:"Name"`
		} `json:"List,omitempty"`
		Items []struct {
			ID      string `json:"Id"`
			GroupID string `json:"GroupId"`
			Name    string `json:"Name"`
		} `json:"Items,omitempty"`
	} `json:"Result"`
}

func init() {
	resolveVirtualPortraitAssetURI = defaultResolveVirtualPortraitAssetURI
}

func defaultResolveVirtualPortraitAssetURI(info *relaycommon.RelayInfo, item ContentItem) (string, error) {
	if info == nil {
		return "", errors.New("virtual portrait relay info is nil")
	}
	if item.ImageURL == nil || strings.TrimSpace(item.ImageURL.URL) == "" {
		return "", nil
	}

	cfg, err := resolveVirtualPortraitConfig(info)
	if err != nil {
		return "", err
	}
	client, err := newVirtualPortraitClient(info, cfg)
	if err != nil {
		return "", err
	}

	groupID := strings.TrimSpace(cfg.GroupID)
	if groupID == "" {
		groupID, err = client.resolveGroupID(cfg)
		if err != nil {
			return "", err
		}
	}

	assetID, err := client.createAsset(groupID, cfg.ProjectName, item.ImageURL.URL)
	if err != nil {
		return "", err
	}
	if assetID == "" {
		return "", errors.New("火山素材创建失败：未返回 AssetId")
	}

	if err = client.waitForAssetActive(assetID, cfg.ProjectName); err != nil {
		return "", err
	}
	return "asset://" + assetID, nil
}

func resolveVirtualPortraitConfig(info *relaycommon.RelayInfo) (*virtualPortraitConfig, error) {
	cfg := &virtualPortraitConfig{
		Region:      virtualPortraitDefaultRegion,
		ProjectName: virtualPortraitDefaultProject,
		GroupName:   virtualPortraitDefaultGroupName,
	}

	mergeVirtualPortraitConfig(cfg, extractVirtualPortraitConfigFromEnv())

	if info != nil && info.ChannelMeta != nil && info.ChannelMeta.ChannelId > 0 {
		if channelModel, err := model.GetChannelById(info.ChannelMeta.ChannelId, true); err == nil && channelModel != nil {
			mergeVirtualPortraitConfig(cfg, extractVirtualPortraitConfigFromOtherInfo(channelModel.GetOtherInfo()))
		}
	}

	if info != nil && info.ChannelMeta != nil {
		mergeVirtualPortraitConfig(cfg, extractVirtualPortraitConfigFromOtherInfo(info.ChannelMeta.ParamOverride))
	}

	cfg.AccessKey = strings.TrimSpace(cfg.AccessKey)
	cfg.SecretKey = strings.TrimSpace(cfg.SecretKey)
	cfg.Region = strings.TrimSpace(cfg.Region)
	cfg.ProjectName = strings.TrimSpace(cfg.ProjectName)
	cfg.GroupID = strings.TrimSpace(cfg.GroupID)
	cfg.GroupName = strings.TrimSpace(cfg.GroupName)

	if cfg.Region == "" {
		cfg.Region = virtualPortraitDefaultRegion
	}
	if cfg.ProjectName == "" {
		cfg.ProjectName = virtualPortraitDefaultProject
	}
	if cfg.GroupName == "" {
		cfg.GroupName = virtualPortraitDefaultGroupName
	}
	if cfg.AccessKey == "" || cfg.SecretKey == "" {
		return nil, errors.New("未配置 Seedance 2.0 虚拟人像库 AK/SK")
	}
	return cfg, nil
}

func extractVirtualPortraitConfigFromEnv() virtualPortraitConfig {
	return virtualPortraitConfig{
		AccessKey:   firstNonEmptyEnv("DOUBAO_VIRTUAL_PORTRAIT_ACCESS_KEY", "DOUBAO_ACCESS_KEY"),
		SecretKey:   firstNonEmptyEnv("DOUBAO_VIRTUAL_PORTRAIT_SECRET_KEY", "DOUBAO_SECRET_ACCESS"),
		Region:      firstNonEmptyEnv("DOUBAO_VIRTUAL_PORTRAIT_REGION", "DOUBAO_REGION"),
		ProjectName: firstNonEmptyEnv("DOUBAO_VIRTUAL_PORTRAIT_PROJECT_NAME", "DOUBAO_PROJECT_NAME"),
		GroupID:     firstNonEmptyEnv("DOUBAO_VIRTUAL_PORTRAIT_GROUP_ID", "DOUBAO_GROUP_ID"),
		GroupName:   firstNonEmptyEnv("DOUBAO_VIRTUAL_PORTRAIT_GROUP_NAME", "DOUBAO_GROUP_NAME"),
	}
}

func extractVirtualPortraitConfigFromOtherInfo(otherInfo map[string]interface{}) virtualPortraitConfig {
	cfg := virtualPortraitConfig{}
	if len(otherInfo) == 0 {
		return cfg
	}

	if nestedRaw, ok := otherInfo["virtual_portrait"]; ok {
		if nested, ok := nestedRaw.(map[string]interface{}); ok {
			cfg.AccessKey = stringValueByKeys(nested, "access_key", "accessKey", "ak", "AccessKey")
			cfg.SecretKey = stringValueByKeys(nested, "secret_key", "secretKey", "sk", "SecretKey")
			cfg.Region = stringValueByKeys(nested, "region", "Region")
			cfg.ProjectName = stringValueByKeys(nested, "project_name", "projectName", "ProjectName")
			cfg.GroupID = stringValueByKeys(nested, "group_id", "groupId", "GroupId", "Id")
			cfg.GroupName = stringValueByKeys(nested, "group_name", "groupName", "Name")
		}
	}

	if cfg.AccessKey == "" {
		cfg.AccessKey = stringValueByKeys(otherInfo, "virtual_portrait_access_key", "volc_virtual_portrait_access_key")
	}
	if cfg.SecretKey == "" {
		cfg.SecretKey = stringValueByKeys(otherInfo, "virtual_portrait_secret_key", "volc_virtual_portrait_secret_key")
	}
	if cfg.Region == "" {
		cfg.Region = stringValueByKeys(otherInfo, "virtual_portrait_region", "volc_virtual_portrait_region")
	}
	if cfg.ProjectName == "" {
		cfg.ProjectName = stringValueByKeys(otherInfo, "virtual_portrait_project_name", "volc_virtual_portrait_project_name")
	}
	if cfg.GroupID == "" {
		cfg.GroupID = stringValueByKeys(otherInfo, "virtual_portrait_group_id", "volc_virtual_portrait_group_id")
	}
	if cfg.GroupName == "" {
		cfg.GroupName = stringValueByKeys(otherInfo, "virtual_portrait_group_name", "volc_virtual_portrait_group_name")
	}
	return cfg
}

func mergeVirtualPortraitConfig(dst *virtualPortraitConfig, src virtualPortraitConfig) {
	if dst == nil {
		return
	}
	if strings.TrimSpace(src.AccessKey) != "" {
		dst.AccessKey = strings.TrimSpace(src.AccessKey)
	}
	if strings.TrimSpace(src.SecretKey) != "" {
		dst.SecretKey = strings.TrimSpace(src.SecretKey)
	}
	if strings.TrimSpace(src.Region) != "" {
		dst.Region = strings.TrimSpace(src.Region)
	}
	if strings.TrimSpace(src.ProjectName) != "" {
		dst.ProjectName = strings.TrimSpace(src.ProjectName)
	}
	if strings.TrimSpace(src.GroupID) != "" {
		dst.GroupID = strings.TrimSpace(src.GroupID)
	}
	if strings.TrimSpace(src.GroupName) != "" {
		dst.GroupName = strings.TrimSpace(src.GroupName)
	}
}

func stringValueByKeys(data map[string]interface{}, keys ...string) string {
	for _, key := range keys {
		if value, ok := data[key]; ok {
			if s := strings.TrimSpace(common.Interface2String(value)); s != "" {
				return s
			}
		}
	}
	return ""
}

func firstNonEmptyEnv(keys ...string) string {
	for _, key := range keys {
		if value := strings.TrimSpace(common.GetEnvOrDefaultString(key, "")); value != "" {
			return value
		}
	}
	return ""
}

func newVirtualPortraitClient(info *relaycommon.RelayInfo, cfg *virtualPortraitConfig) (*virtualPortraitClient, error) {
	proxy := ""
	if info != nil && info.ChannelMeta != nil {
		proxy = info.ChannelMeta.ChannelSetting.Proxy
	}
	httpClient, err := service.GetHttpClientWithProxy(proxy)
	if err != nil {
		return nil, errors.Wrap(err, "new virtual portrait http client failed")
	}
	return &virtualPortraitClient{
		accessKey: strings.TrimSpace(cfg.AccessKey),
		secretKey: strings.TrimSpace(cfg.SecretKey),
		region:    strings.TrimSpace(cfg.Region),
		baseURL:   fmt.Sprintf(virtualPortraitOpenAPIHostFormat, strings.TrimSpace(cfg.Region)),
		proxy:     proxy,
		client:    httpClient,
	}, nil
}

func (c *virtualPortraitClient) resolveGroupID(cfg *virtualPortraitConfig) (string, error) {
	groupName := strings.TrimSpace(cfg.GroupName)
	if groupName == "" {
		groupName = virtualPortraitDefaultGroupName
	}

	resp, err := c.call("ListAssetGroups", map[string]interface{}{
		"Filter": map[string]interface{}{
			"Name":      groupName,
			"GroupType": virtualPortraitGroupTypeAIGC,
		},
		"PageNumber":  1,
		"PageSize":    10,
		"ProjectName": cfg.ProjectName,
	})
	if err == nil {
		for _, row := range append(append(resp.Result.AssetGroups, resp.Result.List...), resp.Result.Items...) {
			name := strings.TrimSpace(row.Name)
			if name != "" && name != groupName {
				continue
			}
			groupID := firstNonEmpty(row.GroupID, row.ID)
			if groupID != "" {
				return groupID, nil
			}
		}
	}

	created, createErr := c.call("CreateAssetGroup", map[string]interface{}{
		"Name":        groupName,
		"GroupType":   virtualPortraitGroupTypeAIGC,
		"ProjectName": cfg.ProjectName,
	})
	if createErr != nil {
		return "", createErr
	}
	groupID := firstNonEmpty(created.Result.GroupID, created.Result.ID)
	if groupID == "" {
		return "", errors.New("火山素材组创建失败：未返回 GroupId")
	}
	return groupID, nil
}

func (c *virtualPortraitClient) createAsset(groupID, projectName, sourceURL string) (string, error) {
	resp, err := c.call("CreateAsset", map[string]interface{}{
		"GroupId":     groupID,
		"URL":         sourceURL,
		"AssetType":   virtualPortraitAssetTypeImage,
		"ProjectName": projectName,
	})
	if err != nil {
		return "", err
	}
	return firstNonEmpty(resp.Result.AssetID, resp.Result.ID), nil
}

func (c *virtualPortraitClient) waitForAssetActive(assetID, projectName string) error {
	var lastErr error
	for idx, interval := range virtualPortraitPollIntervals {
		if idx > 0 && interval > 0 {
			time.Sleep(interval)
		}
		resp, err := c.call("GetAsset", map[string]interface{}{
			"Id":          assetID,
			"ProjectName": projectName,
		})
		if err != nil {
			lastErr = err
			continue
		}

		switch strings.TrimSpace(resp.Result.Status) {
		case "", virtualPortraitStatusProcessing:
			continue
		case virtualPortraitStatusActive:
			return nil
		case virtualPortraitStatusFailed:
			return buildVirtualPortraitAssetFailedError(resp)
		default:
			lastErr = fmt.Errorf("未知虚拟人像素材状态: %s", resp.Result.Status)
		}
	}
	if lastErr != nil {
		return lastErr
	}
	return errors.New("虚拟人像素材处理超时")
}

func buildVirtualPortraitAssetFailedError(resp *virtualPortraitOpenAPIResponse) error {
	if resp != nil && resp.Result.Error != nil {
		message := strings.TrimSpace(resp.Result.Error.Message)
		if message != "" {
			if strings.Contains(message, "不合法") || strings.Contains(message, "非法") || strings.Contains(message, "人脸") {
				return errors.New("图片内容不合法")
			}
			return errors.New(message)
		}
	}
	return errors.New("图片内容不合法")
}

func (c *virtualPortraitClient) call(action string, body map[string]interface{}) (*virtualPortraitOpenAPIResponse, error) {
	payloadBytes, err := common.Marshal(body)
	if err != nil {
		return nil, errors.Wrap(err, "marshal virtual portrait payload failed")
	}

	requestURL := c.baseURL + "/?Action=" + url.QueryEscape(action) + "&Version=" + url.QueryEscape(virtualPortraitAPIVersion)
	req, err := http.NewRequest(http.MethodPost, requestURL, bytes.NewReader(payloadBytes))
	if err != nil {
		return nil, errors.Wrap(err, "new virtual portrait request failed")
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Content-Type", "application/json")
	if err = c.signRequest(req, payloadBytes); err != nil {
		return nil, err
	}

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, errors.Wrap(err, "do virtual portrait request failed")
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, errors.Wrap(err, "read virtual portrait response failed")
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("virtual portrait request failed: status=%d body=%s", resp.StatusCode, string(respBody))
	}

	var parsed virtualPortraitOpenAPIResponse
	if err = common.Unmarshal(respBody, &parsed); err != nil {
		return nil, errors.Wrapf(err, "unmarshal virtual portrait response failed: %s", string(respBody))
	}
	if parsed.ResponseMetadata.Error != nil {
		message := strings.TrimSpace(parsed.ResponseMetadata.Error.Message)
		if strings.Contains(message, "不合法") || strings.Contains(message, "非法") || strings.Contains(message, "人脸") {
			return nil, errors.New("图片内容不合法")
		}
		if message == "" {
			message = "虚拟人像库请求失败"
		}
		return nil, errors.New(message)
	}
	return &parsed, nil
}

func (c *virtualPortraitClient) signRequest(req *http.Request, body []byte) error {
	payloadHash := sha256.Sum256(body)
	hexPayloadHash := hex.EncodeToString(payloadHash[:])

	now := time.Now().UTC()
	xDate := now.Format("20060102T150405Z")
	shortDate := now.Format("20060102")

	req.Header.Set("Host", req.URL.Host)
	req.Header.Set("X-Date", xDate)
	req.Header.Set("X-Content-Sha256", hexPayloadHash)

	queryParams := req.URL.Query()
	queryKeys := make([]string, 0, len(queryParams))
	for key := range queryParams {
		queryKeys = append(queryKeys, key)
	}
	sort.Strings(queryKeys)
	var queryParts []string
	for _, key := range queryKeys {
		values := queryParams[key]
		sort.Strings(values)
		for _, value := range values {
			queryParts = append(queryParts, fmt.Sprintf("%s=%s", url.QueryEscape(key), url.QueryEscape(value)))
		}
	}
	canonicalQuery := strings.Join(queryParts, "&")

	headersToSign := map[string]string{
		"content-type":     req.Header.Get("Content-Type"),
		"host":             req.URL.Host,
		"x-content-sha256": hexPayloadHash,
		"x-date":           xDate,
	}
	signedHeaderKeys := make([]string, 0, len(headersToSign))
	for key := range headersToSign {
		signedHeaderKeys = append(signedHeaderKeys, key)
	}
	sort.Strings(signedHeaderKeys)

	var canonicalHeaders strings.Builder
	for _, key := range signedHeaderKeys {
		canonicalHeaders.WriteString(key)
		canonicalHeaders.WriteString(":")
		canonicalHeaders.WriteString(strings.TrimSpace(headersToSign[key]))
		canonicalHeaders.WriteString("\n")
	}
	signedHeaders := strings.Join(signedHeaderKeys, ";")

	canonicalRequest := fmt.Sprintf("%s\n%s\n%s\n%s\n%s\n%s",
		req.Method,
		req.URL.Path,
		canonicalQuery,
		canonicalHeaders.String(),
		signedHeaders,
		hexPayloadHash,
	)

	hashedCanonicalRequest := sha256.Sum256([]byte(canonicalRequest))
	credentialScope := fmt.Sprintf("%s/%s/%s/request", shortDate, c.region, "ark")
	stringToSign := fmt.Sprintf("HMAC-SHA256\n%s\n%s\n%s",
		xDate,
		credentialScope,
		hex.EncodeToString(hashedCanonicalRequest[:]),
	)

	kDate := hmacSHA256([]byte(c.secretKey), []byte(shortDate))
	kRegion := hmacSHA256(kDate, []byte(c.region))
	kService := hmacSHA256(kRegion, []byte("ark"))
	kSigning := hmacSHA256(kService, []byte("request"))
	signature := hex.EncodeToString(hmacSHA256(kSigning, []byte(stringToSign)))

	req.Header.Set("Authorization", fmt.Sprintf(
		"HMAC-SHA256 Credential=%s/%s, SignedHeaders=%s, Signature=%s",
		c.accessKey,
		credentialScope,
		signedHeaders,
		signature,
	))
	return nil
}

func hmacSHA256(key []byte, data []byte) []byte {
	h := hmac.New(sha256.New, key)
	_, _ = h.Write(data)
	return h.Sum(nil)
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			return trimmed
		}
	}
	return ""
}

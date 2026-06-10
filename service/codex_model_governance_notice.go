package service

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/system_setting"
)

const (
	codexOfficialSourceTimeout      = 10 * time.Second
	codexOfficialSourceMaxBodyBytes = int64(2 * 1024 * 1024)
)

func ExtractCodexOfficialNoticeFindings(content string, modelNames []string, terms []string) []CodexModelUnsupportedFinding {
	findings := make([]CodexModelUnsupportedFinding, 0)
	for _, modelName := range modelNames {
		modelName = strings.TrimSpace(modelName)
		if modelName == "" {
			continue
		}
		match := FindOfficialCodexNoticeMatch(content, []string{modelName}, terms)
		if !match.Matched {
			continue
		}
		findings = append(findings, CodexModelUnsupportedFinding{
			ModelName:   match.ModelName,
			Source:      model.CodexModelGovernanceSourceOfficialCodexNotice,
			MatchedRule: match.Term,
			LastError:   match.Excerpt,
		})
	}
	return findings
}

func FetchCodexOfficialSource(sourceURL string) (string, error) {
	sourceURL = strings.TrimSpace(sourceURL)
	if sourceURL == "" {
		return "", fmt.Errorf("official Codex source URL is empty")
	}
	fetchSetting := system_setting.GetFetchSetting()
	if err := common.ValidateURLWithFetchSetting(sourceURL, fetchSetting.EnableSSRFProtection, fetchSetting.AllowPrivateIp, fetchSetting.DomainFilterMode, fetchSetting.IpFilterMode, fetchSetting.DomainList, fetchSetting.IpList, fetchSetting.AllowedPorts, fetchSetting.ApplyIPFilterForDomain); err != nil {
		return "", fmt.Errorf("request reject: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), codexOfficialSourceTimeout)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, sourceURL, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("User-Agent", "NewAPI-Codex-Governance/1.0")
	client := GetHttpClient()
	if client == nil {
		client = http.DefaultClient
	}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("official Codex source returned status %d", resp.StatusCode)
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, codexOfficialSourceMaxBodyBytes+1))
	if err != nil {
		return "", err
	}
	if int64(len(body)) > codexOfficialSourceMaxBodyBytes {
		return "", fmt.Errorf("official Codex source response exceeds %d bytes", codexOfficialSourceMaxBodyBytes)
	}
	return string(body), nil
}

package channel

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"

	common2 "github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	taskcommon "github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/system_setting"
)

// GCS 视频任务结果转存：取流公共实现（gcs-video-transfer-design.md 4.2）。
//
// 下载硬约束：
//   - 所有 URL 下载前必须过 common.ValidateURLWithFetchSetting（与 video_proxy 同一套校验）；
//   - 必须使用 service.GetHttpClient / GetHttpClientWithProxy（继承 checkRedirect 的
//     重定向逐跳重校验），禁止自建裸 http.Client；
//   - 单次转存超时必须由调用方（S5 worker）经 ctx 强制——RelayTimeout=0 时共享 client
//     无 Timeout，不能依赖 client.Timeout。

// FetchTaskAssetByURL 按 URL 下载任务结果资产，返回 (内容流, Content-Type, error)。
// ch 可为 nil（直链转存无需渠道）；非 nil 时沿用渠道代理设置。
// 调用方负责 Close 返回的 ReadCloser；体积上限由调用方（S5 worker）以
// LimitReader(N+1)+字节计数检测，本函数不截断。
func FetchTaskAssetByURL(ctx context.Context, ch *model.Channel, rawURL string, header http.Header) (io.ReadCloser, string, error) {
	rawURL = strings.TrimSpace(rawURL)
	if rawURL == "" {
		return nil, "", fmt.Errorf("asset url is empty")
	}

	fetchSetting := system_setting.GetFetchSetting()
	if err := common2.ValidateURLWithFetchSetting(rawURL, fetchSetting.EnableSSRFProtection, fetchSetting.AllowPrivateIp, fetchSetting.DomainFilterMode, fetchSetting.IpFilterMode, fetchSetting.DomainList, fetchSetting.IpList, fetchSetting.AllowedPorts, fetchSetting.ApplyIPFilterForDomain); err != nil {
		return nil, "", fmt.Errorf("asset url blocked: %w", err)
	}

	proxy := ""
	if ch != nil {
		proxy = ch.GetSetting().Proxy
	}
	client, err := service.GetHttpClientWithProxy(proxy)
	if err != nil {
		return nil, "", fmt.Errorf("new proxy http client failed: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, rawURL, nil)
	if err != nil {
		return nil, "", fmt.Errorf("new asset request failed: %w", err)
	}
	for k, vs := range header {
		for _, v := range vs {
			req.Header.Add(k, v)
		}
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, "", fmt.Errorf("asset fetch failed: %w", err)
	}
	if resp.StatusCode != http.StatusOK {
		snippet, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		_ = resp.Body.Close()
		return nil, "", fmt.Errorf("asset fetch returned status %d: %s", resp.StatusCode, string(snippet))
	}
	return resp.Body, resp.Header.Get("Content-Type"), nil
}

// ---------------------------------------------------------------------------
// DirectLinkAssets — 直链渠道的可嵌入默认实现（Kling/Ali/Doubao/Jimeng/Hailuo 等）。
// 多资产渠道（Vidu/Pollo）与带鉴权取流渠道（Sora/Gemini/Vertex）按需覆写其中的方法。
// ---------------------------------------------------------------------------

type DirectLinkAssets struct{}

// ExtractUpstreamAssets 默认实现：取 ParseTaskResult 解析出的单个直链作为主视频资产。
// taskResult 由同一轮询周期从脱敏前的原始响应解析而来，对单 video_url 渠道与
// rawRespBody 等价；数组形态的渠道（Kling videos[]、Vidu creations[]、Pollo
// generations[]）必须覆写本方法、基于 rawRespBody 枚举全部资产。
func (DirectLinkAssets) ExtractUpstreamAssets(_ *model.Task, taskResult *relaycommon.TaskInfo, _ []byte) ([]taskcommon.UpstreamAsset, error) {
	if taskResult == nil {
		return nil, fmt.Errorf("task result is nil")
	}
	u := strings.TrimSpace(taskResult.Url)
	if u == "" {
		return nil, fmt.Errorf("upstream succeeded but result url is empty")
	}
	if !strings.HasPrefix(u, "http://") && !strings.HasPrefix(u, "https://") {
		return nil, fmt.Errorf("upstream result url is not a direct http(s) link")
	}
	return []taskcommon.UpstreamAsset{{Index: 0, URL: u, Ext: taskcommon.AssetExtVideo}}, nil
}

// FetchResultContent 默认实现：直接下载 asset.URL。
func (DirectLinkAssets) FetchResultContent(ctx context.Context, _ *model.Task, ch *model.Channel, asset taskcommon.UpstreamAsset) (io.ReadCloser, string, error) {
	return FetchTaskAssetByURL(ctx, ch, asset.URL, nil)
}

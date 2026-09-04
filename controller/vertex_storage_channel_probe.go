package controller

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/relay/channel/vertex"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

const vertexStorageChannelTestContent = "new-api Vertex AI Storage channel test\n"

type vertexStorageChannelProbeDependencies struct {
	newObjectName      func() string
	acquireAccessToken func(vertex.CachedAccessTokenRequest) (string, error)
	doProxy            func(context.Context, vertex.StorageProxyRequest) (*http.Response, error)
}

func defaultVertexStorageChannelProbeDependencies() vertexStorageChannelProbeDependencies {
	return vertexStorageChannelProbeDependencies{
		newObjectName: func() string {
			return ".new-api-channel-test/" + uuid.NewString() + "/test.txt"
		},
		acquireAccessToken: vertex.AcquireCachedAccessToken,
		doProxy:            vertex.DoStorageProxy,
	}
}

func testVertexStorageChannel(ctx context.Context, c *gin.Context, testModel string, deps vertexStorageChannelProbeDependencies) error {
	if c == nil {
		return errors.New("Vertex storage channel test context is required")
	}
	if deps.newObjectName == nil || deps.acquireAccessToken == nil || deps.doProxy == nil {
		return errors.New("Vertex storage channel test dependencies are incomplete")
	}

	modelName := strings.TrimSpace(testModel)
	if !strings.HasPrefix(modelName, relayconstant.VertexStorageModelPrefix) {
		return errors.New("invalid Vertex storage test model")
	}
	bucket, err := relayconstant.NormalizeVertexStorageBucket(strings.TrimPrefix(modelName, relayconstant.VertexStorageModelPrefix))
	if err != nil {
		return fmt.Errorf("invalid Vertex storage test model: %w", err)
	}
	if common.GetContextKeyInt(c, constant.ContextKeyChannelType) != constant.ChannelTypeVertexAi {
		return errors.New("selected channel is not Vertex AI")
	}
	if !relayconstant.VertexStorageChannelSupports(common.GetContextKeyStringSlice(c, constant.ContextKeyChannelModels), bucket) {
		return fmt.Errorf("selected channel does not allow Cloud Storage bucket %q", bucket)
	}

	channelOtherSetting, _ := common.GetContextKeyType[dto.ChannelOtherSettings](c, constant.ContextKeyChannelOtherSetting)
	if channelOtherSetting.VertexKeyType == dto.VertexKeyTypeAPIKey {
		return errors.New("Vertex storage channel test requires service account JSON")
	}
	credentials := vertex.Credentials{}
	if err := common.Unmarshal([]byte(common.GetContextKeyString(c, constant.ContextKeyChannelKey)), &credentials); err != nil {
		return errors.New("selected Vertex AI channel credentials are invalid")
	}

	channelSetting, _ := common.GetContextKeyType[dto.ChannelSettings](c, constant.ContextKeyChannelSetting)
	accessToken, err := deps.acquireAccessToken(vertex.CachedAccessTokenRequest{
		ChannelID:            common.GetContextKeyInt(c, constant.ContextKeyChannelId),
		ChannelIsMultiKey:    common.GetContextKeyBool(c, constant.ContextKeyChannelIsMultiKey),
		ChannelMultiKeyIndex: common.GetContextKeyInt(c, constant.ContextKeyChannelMultiKeyIndex),
		Credentials:          credentials,
		Proxy:                channelSetting.Proxy,
	})
	if err != nil {
		return errors.New("failed to authorize Vertex storage channel test")
	}

	objectName := strings.TrimSpace(deps.newObjectName())
	if objectName == "" {
		return errors.New("Vertex storage channel test object name is empty")
	}
	if ctx == nil {
		ctx = context.Background()
	}

	var probeErrors []error
	uploadQuery := url.Values{}
	uploadQuery.Set("uploadType", "media")
	uploadQuery.Set("name", objectName)
	uploadHeader := make(http.Header)
	uploadHeader.Set("Content-Type", "text/plain; charset=utf-8")
	_, err = runVertexStorageProbeRequest(ctx, deps.doProxy, vertex.StorageProxyRequest{
		Operation:     vertex.StorageOperationUpload,
		Method:        http.MethodPost,
		Bucket:        bucket,
		RawQuery:      uploadQuery.Encode(),
		Header:        uploadHeader,
		Body:          strings.NewReader(vertexStorageChannelTestContent),
		ContentLength: int64(len(vertexStorageChannelTestContent)),
		AccessToken:   accessToken,
		Proxy:         channelSetting.Proxy,
	}, 0)
	if err != nil {
		probeErrors = append(probeErrors, fmt.Errorf("upload temporary object: %w", err))
	}

	downloaded, readErr := runVertexStorageProbeRequest(ctx, deps.doProxy, vertex.StorageProxyRequest{
		Operation:     vertex.StorageOperationGet,
		Method:        http.MethodGet,
		Bucket:        bucket,
		Object:        objectName,
		RawQuery:      "alt=media",
		Header:        make(http.Header),
		ContentLength: 0,
		AccessToken:   accessToken,
		Proxy:         channelSetting.Proxy,
	}, int64(len(vertexStorageChannelTestContent)))
	if readErr != nil {
		probeErrors = append(probeErrors, fmt.Errorf("read temporary object: %w", readErr))
	} else if !bytes.Equal(downloaded, []byte(vertexStorageChannelTestContent)) {
		probeErrors = append(probeErrors, errors.New("read temporary object: content mismatch"))
	}

	cleanupCtx, cancelCleanup := context.WithTimeout(context.WithoutCancel(ctx), 30*time.Second)
	defer cancelCleanup()
	_, deleteErr := runVertexStorageProbeRequest(cleanupCtx, deps.doProxy, vertex.StorageProxyRequest{
		Operation:     vertex.StorageOperationDelete,
		Method:        http.MethodDelete,
		Bucket:        bucket,
		Object:        objectName,
		Header:        make(http.Header),
		ContentLength: 0,
		AccessToken:   accessToken,
		Proxy:         channelSetting.Proxy,
	}, 0)
	if deleteErr != nil {
		probeErrors = append(probeErrors, fmt.Errorf("delete temporary object %q manually if necessary: %w", objectName, deleteErr))
	}

	return errors.Join(probeErrors...)
}

func runVertexStorageProbeRequest(
	ctx context.Context,
	doProxy func(context.Context, vertex.StorageProxyRequest) (*http.Response, error),
	input vertex.StorageProxyRequest,
	maxResponseBytes int64,
) ([]byte, error) {
	response, err := doProxy(ctx, input)
	if response != nil && response.Body != nil {
		defer service.CloseResponseBodyGracefully(response)
	}
	if err != nil {
		return nil, err
	}
	if response == nil || response.Body == nil {
		return nil, errors.New("Google Cloud Storage returned an empty response")
	}
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return nil, fmt.Errorf("Google Cloud Storage returned status %d", response.StatusCode)
	}
	if maxResponseBytes <= 0 {
		return nil, nil
	}
	body, err := io.ReadAll(io.LimitReader(response.Body, maxResponseBytes+1))
	if err != nil {
		return nil, err
	}
	if int64(len(body)) > maxResponseBytes {
		return nil, errors.New("Google Cloud Storage returned an oversized test object")
	}
	return body, nil
}

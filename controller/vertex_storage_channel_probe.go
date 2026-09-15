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

// testVertexStorageChannel verifies real Cloud Storage permissions for the
// bucket named by testModel: it writes, reads back and deletes one temporary
// object with the channel's service account. It never bills the test user and
// never produces a model consume log.
func testVertexStorageChannel(ctx context.Context, c *gin.Context, testModel string) error {
	if c == nil {
		return errors.New("Vertex storage channel test context is required")
	}

	rawBucket, isStorageModel := strings.CutPrefix(strings.TrimSpace(testModel), relayconstant.VertexStorageModelPrefix)
	if !isStorageModel {
		return errors.New("invalid Vertex storage test model")
	}
	bucket, err := relayconstant.NormalizeVertexStorageBucket(rawBucket)
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
	accessToken, err := vertex.AcquireCachedAccessToken(vertex.CachedAccessTokenRequest{
		ChannelID:            common.GetContextKeyInt(c, constant.ContextKeyChannelId),
		ChannelIsMultiKey:    common.GetContextKeyBool(c, constant.ContextKeyChannelIsMultiKey),
		ChannelMultiKeyIndex: common.GetContextKeyInt(c, constant.ContextKeyChannelMultiKeyIndex),
		Credentials:          credentials,
		Proxy:                channelSetting.Proxy,
	})
	if err != nil {
		return errors.New("failed to authorize Vertex storage channel test")
	}

	objectName := ".new-api-channel-test/" + uuid.NewString() + "/test.txt"
	if ctx == nil {
		ctx = context.Background()
	}

	var probeErrors []error
	uploadQuery := url.Values{}
	uploadQuery.Set("uploadType", "media")
	uploadQuery.Set("name", objectName)
	uploadHeader := make(http.Header)
	uploadHeader.Set("Content-Type", "text/plain; charset=utf-8")
	_, err = runVertexStorageProbeRequest(ctx, vertex.StorageProxyRequest{
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

	downloaded, readErr := runVertexStorageProbeRequest(ctx, vertex.StorageProxyRequest{
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

	// Cleanup must still run when the caller's request context is already done,
	// otherwise a cancelled test leaves the temporary object behind.
	cleanupCtx, cancelCleanup := context.WithTimeout(context.WithoutCancel(ctx), 30*time.Second)
	defer cancelCleanup()
	_, deleteErr := runVertexStorageProbeRequest(cleanupCtx, vertex.StorageProxyRequest{
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

func runVertexStorageProbeRequest(ctx context.Context, input vertex.StorageProxyRequest, maxResponseBytes int64) ([]byte, error) {
	response, err := vertex.DoStorageProxy(ctx, input)
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

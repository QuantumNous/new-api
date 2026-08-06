package service

import (
	"context"
	"errors"
	"io"
	"mime/multipart"
	"net/http"
	"path"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
)

const (
	techMobiAssetUploadPath      = "/v1/assets/upload"
	techMobiAssetResponseMaxSize = 1 << 20
)

var (
	errAssetUploadFailed           = errors.New("asset upload failed")
	techMobiAssetFetchSource       = fetchAssetSource
	techMobiAssetHTTPClientFactory = func(channel *model.Channel) (*http.Client, error) {
		return GetHttpClientWithProxy(strings.TrimSpace(channel.GetSetting().Proxy))
	}
)

type techMobiAssetBindingMaterializer struct{}

type techMobiAssetUploadResponse struct {
	AssetURL string `json:"assetUrl"`
}

func (techMobiAssetBindingMaterializer) CreateAsset(ctx context.Context, input AssetMaterializeInput) (AssetMaterializeResult, error) {
	if input.Channel == nil {
		return AssetMaterializeResult{}, errAssetUploadFailed
	}
	modelName := strings.TrimSpace(input.Model)
	apiKey := strings.TrimSpace(input.APIKey)
	if modelName == "" || apiKey == "" {
		return AssetMaterializeResult{}, errAssetUploadFailed
	}

	sourceURL := strings.TrimSpace(input.SourceURL)
	if sourceURL == "" && input.SignSource != nil {
		var err error
		sourceURL, err = input.SignSource(ctx, input.Asset)
		if err != nil {
			return AssetMaterializeResult{}, errAssetUploadFailed
		}
	}
	if sourceURL == "" {
		return AssetMaterializeResult{}, errAssetUploadFailed
	}
	sourceResponse, err := techMobiAssetFetchSource(ctx, sourceURL)
	if err != nil || sourceResponse == nil || sourceResponse.Body == nil || sourceResponse.StatusCode < 200 || sourceResponse.StatusCode >= 300 {
		if sourceResponse != nil && sourceResponse.Body != nil {
			_ = sourceResponse.Body.Close()
		}
		return AssetMaterializeResult{}, errAssetUploadFailed
	}

	client, err := techMobiAssetHTTPClientFactory(input.Channel)
	if err != nil || client == nil {
		_ = sourceResponse.Body.Close()
		return AssetMaterializeResult{}, errAssetUploadFailed
	}
	baseURL := strings.TrimSpace(input.Channel.GetBaseURL())
	if baseURL == "" {
		baseURL = constant.ChannelBaseURLs[constant.ChannelTypeTechMobiVideo]
	}
	requestURL := strings.TrimRight(baseURL, "/") + techMobiAssetUploadPath
	pipeReader, pipeWriter := io.Pipe()
	multipartWriter := multipart.NewWriter(pipeWriter)
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, requestURL, pipeReader)
	if err != nil {
		_ = sourceResponse.Body.Close()
		_ = pipeReader.Close()
		_ = pipeWriter.Close()
		return AssetMaterializeResult{}, errAssetUploadFailed
	}
	request.Header.Set("Accept", "application/json")
	request.Header.Set("Authorization", "Bearer "+apiKey)
	request.Header.Set("Content-Type", multipartWriter.FormDataContentType())

	writeDone := make(chan error, 1)
	go func() {
		defer func() { _ = sourceResponse.Body.Close() }()
		writeDone <- writeTechMobiAssetMultipart(pipeWriter, multipartWriter, modelName, techMobiAssetFilename(input.Asset), sourceResponse.Body)
	}()

	response, requestErr := client.Do(request)
	_ = pipeReader.Close()
	writeErr := <-writeDone
	if requestErr != nil || writeErr != nil || response == nil {
		if response != nil && response.Body != nil {
			_ = response.Body.Close()
		}
		return AssetMaterializeResult{}, errAssetUploadFailed
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return AssetMaterializeResult{}, errAssetUploadFailed
	}

	var uploadResponse techMobiAssetUploadResponse
	if err := common.DecodeJson(io.LimitReader(response.Body, techMobiAssetResponseMaxSize), &uploadResponse); err != nil {
		return AssetMaterializeResult{}, errAssetUploadFailed
	}
	if !isValidTechMobiAssetURL(uploadResponse.AssetURL) {
		return AssetMaterializeResult{}, errAssetUploadFailed
	}
	return AssetMaterializeResult{
		UpstreamAssetID: uploadResponse.AssetURL,
		Status:          model.AssetStatusActive,
	}, nil
}

func (techMobiAssetBindingMaterializer) GetAsset(_ context.Context, _ AssetMaterializeInput, upstreamAssetID string) (AssetMaterializeResult, error) {
	if !isValidTechMobiAssetURL(upstreamAssetID) {
		return AssetMaterializeResult{}, errAssetUploadFailed
	}
	return AssetMaterializeResult{
		UpstreamAssetID: upstreamAssetID,
		Status:          model.AssetStatusActive,
	}, nil
}

func writeTechMobiAssetMultipart(pipeWriter *io.PipeWriter, writer *multipart.Writer, modelName string, filename string, source io.Reader) error {
	if err := writer.WriteField("model", modelName); err != nil {
		_ = pipeWriter.CloseWithError(err)
		return err
	}
	filePart, err := writer.CreateFormFile("file", filename)
	if err != nil {
		_ = pipeWriter.CloseWithError(err)
		return err
	}
	if _, err := io.Copy(filePart, source); err != nil {
		_ = pipeWriter.CloseWithError(err)
		return err
	}
	if err := writer.Close(); err != nil {
		_ = pipeWriter.CloseWithError(err)
		return err
	}
	return pipeWriter.Close()
}

func techMobiAssetFilename(asset model.Asset) string {
	filename := path.Base(strings.TrimSpace(asset.ObjectKey))
	if filename == "" || filename == "." || filename == "/" {
		return "asset"
	}
	return filename
}

func isValidTechMobiAssetURL(raw string) bool {
	return raw == strings.TrimSpace(raw) &&
		strings.HasPrefix(raw, "asset://") &&
		len(raw) > len("asset://") &&
		!strings.ContainsAny(raw, " \t\r\n")
}

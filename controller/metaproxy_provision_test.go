package controller

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func validMetaproxyProvisionRequest() metaproxyProvisionRequest {
	return metaproxyProvisionRequest{
		Revision: "ba57fd0526c6ce9e9869c225ac9997d96b2bbdea",
		Digest:   "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
		Channels: []metaproxyProvisionChannelRequest{
			{
				Type:      1,
				Key:       "secret",
				Name:      "Upstream [one]",
				BaseURL:   "https://upstream.example/v1",
				Models:    "model-one",
				Group:     "standard",
				Priority:  10,
				Weight:    100,
				Status:    1,
				TestModel: "model-one",
			},
		},
		Options: metaproxyProvisionOptionsRequest{
			ModelRatio:       `{"model-one":1}`,
			CompletionRatio:  `{"model-one":2}`,
			CacheRatio:       `{"model-one":0.1}`,
			GroupRatio:       `{"standard":1}`,
			UserUsableGroups: `{"standard":"Standard"}`,
		},
	}
}

func TestValidateMetaproxyProvisionRequestAcceptsCompleteConfig(t *testing.T) {
	request := validMetaproxyProvisionRequest()
	require.NoError(t, validateMetaproxyProvisionRequest(request, request.Digest, "none"))
}

func TestValidateMetaproxyProvisionRequestRejectsMismatchedIdempotencyKey(t *testing.T) {
	request := validMetaproxyProvisionRequest()
	err := validateMetaproxyProvisionRequest(
		request,
		"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
		"none",
	)
	require.ErrorContains(t, err, "Idempotency-Key")
}

func TestValidateMetaproxyProvisionRequestRejectsDuplicateChannelNames(t *testing.T) {
	request := validMetaproxyProvisionRequest()
	request.Channels = append(request.Channels, request.Channels[0])
	err := validateMetaproxyProvisionRequest(request, request.Digest, "none")
	require.ErrorContains(t, err, "duplicate channel name")
}

func TestValidateMetaproxyProvisionRequestRejectsEnabledModelWithoutPrice(t *testing.T) {
	request := validMetaproxyProvisionRequest()
	request.Options.ModelRatio = `{}`
	err := validateMetaproxyProvisionRequest(request, request.Digest, "none")
	require.ErrorContains(t, err, "model-one")
	require.ErrorContains(t, err, "ModelRatio")
}

func TestValidateMetaproxyProvisionRequestAllowsDisabledUnpricedModel(t *testing.T) {
	request := validMetaproxyProvisionRequest()
	request.Channels[0].Status = 2
	request.Options.ModelRatio = `{}`
	require.NoError(t, validateMetaproxyProvisionRequest(request, request.Digest, "none"))
}

func TestValidateMetaproxyProvisionRequestAllowsUnpricedModelInUnpublishedGroup(t *testing.T) {
	request := validMetaproxyProvisionRequest()
	request.Options.ModelRatio = `{}`
	request.Options.GroupRatio = `{}`
	request.Options.UserUsableGroups = `{}`
	require.NoError(t, validateMetaproxyProvisionRequest(request, request.Digest, "none"))
}

func TestValidateMetaproxyProvisionRequestRejectsMalformedRatioJson(t *testing.T) {
	request := validMetaproxyProvisionRequest()
	request.Options.GroupRatio = `{"standard":"free"}`
	err := validateMetaproxyProvisionRequest(request, request.Digest, "none")
	require.ErrorContains(t, err, "GroupRatio")
}

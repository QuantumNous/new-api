package service

import (
	"bytes"
	"context"
	"io"
	"net/url"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"github.com/volcengine/ve-tos-golang-sdk/v2/tos"
	"github.com/volcengine/ve-tos-golang-sdk/v2/tos/enum"
)

type fakeBytePlusTOSAPI struct {
	putInput     *tos.PutObjectV2Input
	presignInput *tos.PreSignedURLInput
	deleteInput  *tos.DeleteObjectV2Input
}

func (f *fakeBytePlusTOSAPI) PutObjectV2(_ context.Context, input *tos.PutObjectV2Input) (*tos.PutObjectV2Output, error) {
	f.putInput = input
	if input.Content != nil {
		_, _ = io.Copy(io.Discard, input.Content)
	}
	return &tos.PutObjectV2Output{}, nil
}

func (f *fakeBytePlusTOSAPI) PreSignedURL(input *tos.PreSignedURLInput) (*tos.PreSignedURLOutput, error) {
	f.presignInput = input
	return &tos.PreSignedURLOutput{SignedUrl: "https://signed.example/object"}, nil
}

func (f *fakeBytePlusTOSAPI) DeleteObjectV2(_ context.Context, input *tos.DeleteObjectV2Input) (*tos.DeleteObjectV2Output, error) {
	f.deleteInput = input
	return &tos.DeleteObjectV2Output{}, nil
}

func TestBytePlusTOSPutObjectUnknownLengthLeavesLengthAndMD5Empty(t *testing.T) {
	api := &fakeBytePlusTOSAPI{}
	store := &bytePlusTOSStore{bucket: "real-person-bucket", client: api}
	require.NoError(t, store.PutObject(context.Background(), "key", bytes.NewBufferString("payload"), "image/png", 0))
	require.NotNil(t, api.putInput)
	require.Equal(t, "real-person-bucket", api.putInput.Bucket)
	require.Equal(t, "key", api.putInput.Key)
	require.Equal(t, "image/png", api.putInput.ContentType)
	require.Equal(t, "private, no-store", api.putInput.CacheControl)
	require.Equal(t, int64(0), api.putInput.ContentLength)
	require.Empty(t, api.putInput.ContentMD5)
}

func TestBytePlusTOSPresignAndDeleteUseCallerTTLAndV2Delete(t *testing.T) {
	api := &fakeBytePlusTOSAPI{}
	store := &bytePlusTOSStore{bucket: "real-person-bucket", client: api}
	signed, err := store.PresignGet(context.Background(), "key", 12*time.Hour)
	require.NoError(t, err)
	require.Equal(t, "https://signed.example/object", signed)
	require.Equal(t, enum.HttpMethodGet, api.presignInput.HTTPMethod)
	require.Equal(t, int64((12 * time.Hour).Seconds()), api.presignInput.Expires)
	require.Equal(t, "real-person-bucket", api.presignInput.Bucket)
	require.Equal(t, "key", api.presignInput.Key)

	require.NoError(t, store.DeleteObject(context.Background(), "key"))
	require.NotNil(t, api.deleteInput)
	require.Equal(t, "real-person-bucket", api.deleteInput.Bucket)
	require.Equal(t, "key", api.deleteInput.Key)
}

func TestBytePlusTOSStoreFactoryDefaultsToSDKStore(t *testing.T) {
	store, err := bytePlusTempObjectStoreFactory(testBytePlusRealPersonCreds("https://tos-ap-southeast-1.ibytepluses.com"))
	require.NoError(t, err)
	require.NotNil(t, store)
}

func TestBytePlusTOSNewStoreRejectsURLOnlyCredentialsBeforeSDKClient(t *testing.T) {
	_, err := newBytePlusTOSStore(mustParseBytePlusCredentials(t, urlOnlyRealPersonKey()))

	require.EqualError(t, err, "byteplus real-person tos_bucket is required")
}

func TestBytePlusTOSNewStoreValidatesCredentialsBeforeSDKClient(t *testing.T) {
	_, err := newBytePlusTOSStore(BytePlusCredentials{})
	require.Error(t, err)
	require.NotContains(t, err.Error(), "tos-ap-southeast-1")

	store, err := newBytePlusTOSStore(testBytePlusRealPersonCreds("https://tos-ap-southeast-1.ibytepluses.com"))
	require.NoError(t, err)
	require.NotNil(t, store)
}

func TestBytePlusTOSPresignUsesPublicEndpointWhenStorageEndpointIsInternal(t *testing.T) {
	store, err := newBytePlusTOSStore(testBytePlusRealPersonCreds("https://tos-ap-southeast-1.ibytepluses.com"))
	require.NoError(t, err)

	signed, err := store.PresignGet(context.Background(), "real/person.png", time.Hour)
	require.NoError(t, err)
	parsed, err := url.Parse(signed)
	require.NoError(t, err)
	require.Equal(t, "real-person-bucket.tos-ap-southeast-1.bytepluses.com", parsed.Hostname())
	require.NotContains(t, signed, "ibytepluses.com")
}

func mustParseBytePlusCredentials(t *testing.T, raw string) BytePlusCredentials {
	t.Helper()
	creds, err := ParseBytePlusCredentials(raw)
	require.NoError(t, err)
	return creds
}

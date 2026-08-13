package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
)

func TestValidateChannelRejectsInvalidMaxConcurrency(t *testing.T) {
	require.ErrorContains(t, validateChannel(nil, true), "channel cannot be empty")

	err := validateChannel(&model.Channel{MaxConcurrency: -1}, true)
	require.ErrorContains(t, err, "channel max concurrency cannot be negative")
}

func TestValidateChannelRejectsModelAPISeedanceProxy(t *testing.T) {
	setting := `{"proxy":"  socks5://127.0.0.1:1080  "}`
	channel := &model.Channel{
		Type:    constant.ChannelTypeModelAPISeedance,
		Key:     "sk-test",
		Models:  "doubao-seedance-2-5-260628",
		Setting: &setting,
	}

	err := validateChannel(channel, true)
	require.ErrorContains(t, err, "this channel type does not support proxy")
	require.NotContains(t, err.Error(), "ModelAPI")
	require.NotContains(t, err.Error(), "modelapi")
	require.NotContains(t, err.Error(), "api.modelapi.co")
}

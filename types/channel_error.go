package types

type ChannelError struct {
	ChannelId   int    `json:"channel_id"`
	ChannelType int    `json:"channel_type"`
	ChannelName string `json:"channel_name"`
	IsMultiKey  bool   `json:"is_multi_key"`
	// KeyIndex is the index of the specific key that produced the
	// error, when the channel is in multi-key mode. nil means the
	// caller did not have a key index available (single-key channels
	// or paths that skip the per-key lookup). The cooldown handler
	// uses this to scope the skip to the bad key instead of the
	// whole channel.
	KeyIndex  *int   `json:"key_index,omitempty"`
	AutoBan   bool   `json:"auto_ban"`
	UsingKey  string `json:"using_key"`
}

func NewChannelError(channelId int, channelType int, channelName string, isMultiKey bool, usingKey string, autoBan bool) *ChannelError {
	return &ChannelError{
		ChannelId:   channelId,
		ChannelType: channelType,
		ChannelName: channelName,
		IsMultiKey:  isMultiKey,
		AutoBan:     autoBan,
		UsingKey:    usingKey,
	}
}

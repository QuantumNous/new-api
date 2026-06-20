package model

// ChannelPickFilter optionally restricts channel selection (e.g. Codex client policy).
type ChannelPickFilter func(*Channel) bool

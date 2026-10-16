package constant

// BatchGroup is the system-preset group reserved for batch inference
// platforms. API keys in this group cannot call the relay API; they are only
// charged through the administrator batch billing API.
const BatchGroup = "batch"

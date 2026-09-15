package mocks

//go:generate mockgen -package mocks -destination metadata.go -mock_names Provider=MockMetadataProvider github.com/go-webauthn/webauthn/metadata Provider

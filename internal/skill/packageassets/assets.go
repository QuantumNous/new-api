package packageassets

import _ "embed"

//go:embed runtime/deeprouter_skill_runner.py
var runtimeClient []byte

//go:embed runtime/README.md
var runtimeReadme []byte

func RuntimeClient() []byte {
	return append([]byte(nil), runtimeClient...)
}

func RuntimeREADME() []byte {
	return append([]byte(nil), runtimeReadme...)
}

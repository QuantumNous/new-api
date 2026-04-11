package main

import (
	"context"
	"encoding/json"
	"flag"
	"log"
	"os"

	"github.com/QuantumNous/new-api/deploy/lab/governorlab"
)

func main() {
	baseURL := flag.String("base-url", "http://127.0.0.1:3000", "new-api base URL")
	username := flag.String("username", "rootlab", "root username for lab setup/login")
	password := flag.String("password", "rootpass123", "root password for lab setup/login")
	selfUseMode := flag.Bool("self-use-mode", true, "enable self-use mode during setup")
	demoSite := flag.Bool("demo-site", false, "enable demo site mode during setup")
	channelName := flag.String("channel-name", "governor-lab-mock", "lab channel name")
	channelKey := flag.String("channel-key", "mock-upstream-key", "upstream API key stored on the lab channel")
	channelType := flag.Int("channel-type", 1, "channel type id")
	channelModel := flag.String("channel-model", "gpt-4o-mini", "model name exposed by the lab channel")
	channelGroup := flag.String("channel-group", "default", "channel group")
	channelBaseURL := flag.String("channel-base-url", "http://127.0.0.1:8080", "mock upstream base URL")
	channelSettingsFile := flag.String("channel-settings-file", "", "path to channel settings JSON")
	tokenName := flag.String("token-name", "governor-lab-token", "user token name")
	tokenGroup := flag.String("token-group", "default", "user token group")
	outputEnvFile := flag.String("output-env-file", "", "optional env file path for shell wrappers")
	flag.Parse()

	if *channelSettingsFile == "" {
		log.Fatal("channel-settings-file is required")
	}

	channelSettings, err := governorlab.LoadChannelSettings(*channelSettingsFile)
	if err != nil {
		log.Fatal(err)
	}

	client, err := governorlab.NewClient(*baseURL)
	if err != nil {
		log.Fatal(err)
	}

	result, err := client.Bootstrap(context.Background(), governorlab.BootstrapConfig{
		Username:           *username,
		Password:           *password,
		SelfUseModeEnabled: *selfUseMode,
		DemoSiteEnabled:    *demoSite,
		ChannelName:        *channelName,
		ChannelKey:         *channelKey,
		ChannelType:        *channelType,
		ChannelModel:       *channelModel,
		ChannelGroup:       *channelGroup,
		ChannelBaseURL:     *channelBaseURL,
		ChannelSettings:    channelSettings,
		TokenName:          *tokenName,
		TokenGroup:         *tokenGroup,
	})
	if err != nil {
		log.Fatal(err)
	}

	if *outputEnvFile != "" {
		if err := governorlab.WriteEnvFile(*outputEnvFile, result); err != nil {
			log.Fatal(err)
		}
	}

	encoder := json.NewEncoder(os.Stdout)
	encoder.SetIndent("", "  ")
	if err := encoder.Encode(result); err != nil {
		log.Fatal(err)
	}
}

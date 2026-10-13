package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"log"
	"os"
	"time"

	"smart-router/api"
	"smart-router/connectors"
	"smart-router/store"
)

func main() {
	databasePath := flag.String("database", "smart-router.db", "router-owned SQLite database")
	bindingID := flag.String("binding", "", "opaque binding ID to update")
	provider := flag.String("provider", "", "synthetic connector: ebond, hualong, or leyi")
	flag.Parse()
	if *bindingID == "" || *provider == "" {
		log.Fatal("-binding and -provider are required")
	}

	ctx := context.Background()
	observation, err := probe(ctx, *provider)
	if err != nil {
		log.Fatal(err)
	}
	database, err := store.OpenSQLite(ctx, *databasePath)
	if err != nil {
		log.Fatal(err)
	}
	defer func() { _ = database.Close() }()
	if err := database.SetObservation(ctx, *bindingID, store.Observation{
		Health: observation.Health, Fingerprint: observation.Fingerprint,
		ObservedAt: time.Now().UTC(),
	}); err != nil {
		log.Fatal(err)
	}
	if err := json.NewEncoder(os.Stdout).Encode(observation); err != nil {
		log.Fatal(err)
	}
}

func probe(ctx context.Context, provider string) (connectors.Observation, error) {
	switch provider {
	case "ebond":
		return (connectors.EBond{}).Probe(ctx, connectors.EBondFixture{
			HTTPStatus: 200, Revision: "synthetic-v1",
			Models: []string{"synthetic-model"},
			Protocols: []api.Protocol{
				api.ProtocolChat, api.ProtocolResponses, api.ProtocolMessages,
			},
			LatencyMS: 1,
		})
	case "hualong":
		return (connectors.Hualong{}).Probe(ctx, connectors.HualongFixture{
			Code: "OK", Build: "synthetic-v1",
			Offerings: []connectors.HualongOffering{
				{Model: "synthetic-model", Protocol: api.ProtocolChat},
				{Model: "synthetic-model", Protocol: api.ProtocolResponses},
				{Model: "synthetic-model", Protocol: api.ProtocolMessages},
			},
			LatencyMS: 1,
		})
	case "leyi":
		return (connectors.Leyi{}).Probe(ctx, connectors.LeyiFixture{
			Available: true, Release: "synthetic-v1",
			Capabilities: map[api.Protocol][]string{
				api.ProtocolChat:      {"synthetic-model"},
				api.ProtocolResponses: {"synthetic-model"},
				api.ProtocolMessages:  {"synthetic-model"},
			},
			LatencyMS: 1,
		})
	default:
		return connectors.Observation{}, fmt.Errorf(
			"unsupported synthetic provider %q: %w", provider, errors.ErrUnsupported,
		)
	}
}

package main

import (
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/router"
)

type runMode string

const (
	runModeAll       runMode = "all"
	runModeServe     runMode = "serve"
	runModeWorker    runMode = "worker"
	runModeScheduler runMode = "scheduler"
	runModeMigrate   runMode = "migrate"
)

func parseRunMode(value string) (runMode, error) {
	switch runMode(strings.ToLower(strings.TrimSpace(value))) {
	case "", runModeAll:
		return runModeAll, nil
	case runModeServe:
		return runModeServe, nil
	case runModeWorker:
		return runModeWorker, nil
	case runModeScheduler:
		return runModeScheduler, nil
	case runModeMigrate:
		return runModeMigrate, nil
	default:
		return "", errors.New("RUN_MODE must be one of: all, serve, worker, scheduler, migrate")
	}
}

func (mode runMode) servesHTTP() bool {
	return mode == runModeAll || mode == runModeServe
}

func (mode runMode) runsWorker() bool {
	return mode == runModeAll || mode == runModeWorker
}

func (mode runMode) runsScheduler() bool {
	return mode == runModeAll || mode == runModeScheduler
}

func parseRuntimeConfig(runModeValue, planeValue, nodeType string) (runMode, router.Plane, error) {
	mode, err := parseRunMode(runModeValue)
	if err != nil {
		return "", "", err
	}
	plane, err := router.ParsePlane(planeValue)
	if err != nil {
		return "", "", err
	}
	if mode == runModeMigrate && strings.EqualFold(strings.TrimSpace(nodeType), "slave") {
		return "", "", fmt.Errorf("RUN_MODE=migrate requires NODE_TYPE to be master or unset")
	}
	if (mode == runModeWorker || mode == runModeScheduler) && strings.EqualFold(strings.TrimSpace(nodeType), "slave") {
		return "", "", fmt.Errorf("RUN_MODE=%s requires NODE_TYPE to be master or unset", mode)
	}
	return mode, plane, nil
}

package service

// One Bureau V2 card a day when Lumia's Anthropic credit keeps running dry.
// Every supplier credit failure is counted where it is logged ("hw supplier
// credit exhausted"); the failure that brings the last hour to the threshold
// files the card for the CEO route. No timer, no model: the count only moves
// on a real failure, and the card day is kept in an option, so a deploy does
// not file the same day again.

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

// HwOptionSupplierCreditCardDay keeps the UTC day (2006-01-02) of the last
// supplier credit card.
const HwOptionSupplierCreditCardDay = "HwSupplierCreditCardDay"

const (
	// hwSupplierCreditCardThreshold failures within one hour file the card.
	hwSupplierCreditCardThreshold = 5
	hwSupplierCreditCardWindow    = time.Hour
	// HwBureauAgentCEO decides on the supplier: only the CEO route contacts Lumia.
	HwBureauAgentCEO = "aec88fb7-3de7-41a4-83d3-81d67b59b3f8"
)

type hwSupplierCreditFailure struct {
	at        time.Time
	channelID int
	model     string
}

var hwSupplierCredit = struct {
	sync.Mutex
	failures []hwSupplierCreditFailure
	posting  bool
	retryAt  time.Time
}{}

// hwSupplierCreditPostCard is the board call; tests replace it.
var hwSupplierCreditPostCard = func(issue hwBureauIssueRequest) error {
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	_, err := hwBureauPostIssue(ctx, HwBureauCardConfigFromEnv(), issue)
	return err
}

// HwCountSupplierCreditFailure records one supplier credit failure and, when
// the last hour reaches the threshold and today has no card yet, files the
// card in the background. It never blocks or fails the request.
func HwCountSupplierCreditFailure(channelID int, modelName string, now time.Time) {
	hwSupplierCredit.Lock()
	defer hwSupplierCredit.Unlock()
	from := now.Add(-hwSupplierCreditCardWindow)
	kept := hwSupplierCredit.failures[:0]
	for _, failure := range hwSupplierCredit.failures {
		if failure.at.After(from) {
			kept = append(kept, failure)
		}
	}
	hwSupplierCredit.failures = append(kept, hwSupplierCreditFailure{at: now, channelID: channelID, model: modelName})
	day := now.UTC().Format("2006-01-02")
	if len(hwSupplierCredit.failures) < hwSupplierCreditCardThreshold || hwSupplierCredit.posting ||
		now.Before(hwSupplierCredit.retryAt) || strings.TrimSpace(hwOptionValue(HwOptionSupplierCreditCardDay)) == day {
		return
	}
	hwSupplierCredit.posting = true
	issue := hwSupplierCreditCard(hwSupplierCredit.failures, now)
	go func() {
		var err error
		defer func() {
			if r := recover(); r != nil {
				err = fmt.Errorf("supplier credit card panicked: %v", r)
			}
			hwSupplierCredit.Lock()
			hwSupplierCredit.posting = false
			if err != nil {
				hwSupplierCredit.retryAt = now.Add(hwIncidentCardRetryAfter)
			}
			hwSupplierCredit.Unlock()
			if err != nil {
				common.SysError(common.LogText("supplier credit card not filed (class %s); retried after the back-off", hwPricingErrorClass(err)))
			}
		}()
		if err = hwSupplierCreditPostCard(issue); err == nil {
			err = model.UpdateOption(HwOptionSupplierCreditCardDay, day)
		}
	}()
}

// hwSupplierCreditCard writes the card with the counts of the last hour per
// model and channel, never the supplier text.
func hwSupplierCreditCard(failures []hwSupplierCreditFailure, now time.Time) hwBureauIssueRequest {
	counts := make(map[string]int)
	for _, failure := range failures {
		counts[fmt.Sprintf("%s op kanaal %d", failure.model, failure.channelID)]++
	}
	lines := make([]string, 0, len(counts))
	for key := range counts {
		lines = append(lines, key)
	}
	sort.Strings(lines)
	var b strings.Builder
	fmt.Fprintf(&b, "Automatisch gemeld door api.hisarweb.be: %d keer \"hw supplier credit exhausted\" in het uur tot %s UTC (drempel %d per uur).\n\n",
		len(failures), now.UTC().Format("2006-01-02 15:04"), hwSupplierCreditCardThreshold)
	b.WriteString("Lumia weigert Claude-modellen met \"credit balance is too low\" (Anthropic-tegoed achter Lumia). Per model en kanaal:\n")
	for _, key := range lines {
		fmt.Fprintf(&b, "- %s: %d\n", key, counts[key])
	}
	b.WriteString("\nDe gateway herhaalt één keer, stelt een gezond model voor en toont het label \"tijdelijk niet beschikbaar\". Besluit voor de CEO-route: Lumia aanspreken op het wisselvallige tegoed. Deze kaart komt hooguit één keer per dag.")
	return hwBureauIssueRequest{
		Title:           "Lumia: Anthropic-tegoed wisselvallig leeg (" + now.UTC().Format("2006-01-02") + ")",
		Description:     b.String(),
		Priority:        "high",
		Status:          "todo",
		AssigneeAgentID: HwBureauAgentCEO,
	}
}

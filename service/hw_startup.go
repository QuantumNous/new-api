package service

import (
	"os"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

// HwAfterEnv runs the HisarWeb checks that need the environment of the running
// process. It must run after .env is loaded, because APP_ENV and the skip flag
// may come from that file. An unsafe configuration stops the process with a
// message that names the variables only, never their values.
func HwAfterEnv() {
	if err := hwAfterEnvCheck(); err != nil {
		common.FatalLog(common.LogText("invalid environment configuration: %s", err.Error()))
	}
}

// hwAfterEnvCheck reports the HisarWeb findings of a loaded environment without
// stopping the process, so the decision itself stays testable. The batch-update
// warning is a warning only: the upstream batch block keeps running, the line
// merely names the double deduction it can cause.
func hwAfterEnvCheck() error {
	if os.Getenv("BATCH_UPDATE_ENABLED") == "true" {
		common.SysError(common.LogText("BATCH_UPDATE_ENABLED=true can deduct customer credit twice: the credit package expiry run reads users.quota while consumption still waits in the batch buffer; run HisarWeb AI with BATCH_UPDATE_ENABLED=false"))
	}
	return common.HwValidateEnvironment()
}

// HwSeedDefaultOptionsLogged fills the production defaults a fresh database
// still misses: the sale groups, the billing ratios of the sold models, the TL
// display and the brand. Existing operator values are never replaced, and a
// failing step is reported without stopping the start-up.
func HwSeedDefaultOptionsLogged() {
	if err := HwSeedDefaultOptions(); err != nil {
		common.SysError(common.LogText("failed to seed the production defaults: %s", err.Error()))
	}
}

// HwStartJobs starts the HisarWeb background jobs that keep the ledger, the
// prices, the mailbox and the public status current. Every job decides its own
// master-node rule, so the order here is the order of the schedule.
func HwStartJobs() {
	// Retire expired credit packages every hour on the master node.
	model.StartHwCreditExpiryJob()
	// Freeze shared-signal and signup-wave accounts for review once a day.
	model.StartHwDailyAbuseSweepJob()
	StartHwOrderExpiryJob()

	// Refresh the TL price snapshot (price list + daily rate) once a day on
	// the master node.
	StartHwPriceSnapshotJob()

	// Mail the customers whose package expires in five days and whose balance
	// fell below the warning level, once a day on the master node.
	StartHwCustomerMailJob()

	// Measure the public service status once a minute on the master node and
	// extend the credit of the packages that ran during an outage.
	StartHwStatusJob()

	// Bundle the /pricing reports into one Bureau V2 card an hour.
	StartHwPricingFeedbackJob()

	// Point the Telegram bot at this server once its token is known.
	if common.IsMasterNode {
		HwRegisterTelegramWebhookInBackground()
		// A model switch in the code must never leave the assistant's own key
		// behind: repair it before the first question arrives.
		HwAssistantRepairKey(HwAdminAgentConfigFromEnv())
	}
}

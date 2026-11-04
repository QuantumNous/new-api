package setting

var (
    NowPaymentsEnabled           bool
    NowPaymentsApiKey            string
    NowPaymentsIPNSecret         string

    NowPaymentsPriceCurrency     = "usd"
    NowPaymentsMinTopUp          = 1

    NowPaymentsFixedRate         bool
    NowPaymentsFeePaidByUser     bool
)

const antomMethods = [
  ['visa.svg', 'Visa'],
  ['mastercard.svg', 'Mastercard'],
  ['unionpay.png', 'UnionPay'],
  ['jcb.png', 'JCB'],
  ['amex.png', 'American Express'],
  ['discover.png', 'Discover'],
  ['apple-pay.svg', 'Apple Pay'],
  ['google-pay.svg', 'Google Pay'],
  ['atm-networks.png', 'ALTO / ATM Bersama / PRIMA'],
] as const

// Decorative brand strip; the enclosing button remains one payment action.
const cryptoMethods = [
  ['btc.png', 'Bitcoin'],
  ['eth.png', 'Ethereum'],
  ['usdt.png', 'USDT'],
  ['usdc.png', 'USDC'],
  ['sol.png', 'Solana'],
  ['bnb.png', 'BNB'],
  ['ltc.png', 'Litecoin'],
  ['doge.png', 'Dogecoin'],
] as const

export function PaymentMethodIcons(props: { method: 'antom' | 'mixpay' }) {
  const methods = props.method === 'mixpay' ? cryptoMethods : antomMethods
  return (
    <span
      aria-hidden='true'
      className='antom-payment-icons block w-full max-w-full min-w-0 shrink-0 overflow-hidden'
    >
      <span className='antom-payment-icons-track flex w-max'>
        {[0, 1].map((copy) => (
          <span
            key={copy}
            className='antom-payment-icons-set flex shrink-0 items-center gap-2 pr-2'
          >
            {methods.map(([file, name]) => (
              <span
                key={file}
                title={name}
                className='flex h-7 w-11 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white p-1'
              >
                <img
                  src={`/payment-methods/${props.method}/${file}`}
                  alt=''
                  className='h-full w-full object-contain'
                />
              </span>
            ))}
          </span>
        ))}
      </span>
    </span>
  )
}

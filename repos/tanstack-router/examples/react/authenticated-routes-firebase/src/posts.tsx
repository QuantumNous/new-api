import axios from 'redaxios'

async function loaderDelayFn<T>(fn: (...args: Array<any>) => Promise<T> | T) {
  const delay = Number(sessionStorage.getItem('loaderDelay') ?? 0)
  const delayPromise = new Promise((r) => setTimeout(r, delay))

  await delayPromise
  const res = await fn()

  return res
}

type Invoice = {
  id: number
  title: string
  body: string
}

let invoices: Array<Invoice> = null!

let invoicesPromise: Promise<void> | undefined = undefined

const ensureInvoices = async () => {
  if (!invoicesPromise) {
    invoicesPromise = Promise.resolve().then(async () => {
      const { data } = await axios.get(
        'https://jsonplaceholder.typicode.com/posts',
      )
      invoices = data.slice(0, 10)
    })
  }

  await invoicesPromise
}

export async function fetchInvoices() {
  return loaderDelayFn(() => ensureInvoices().then(() => invoices))
}

export async function fetchInvoiceById(id: number) {
  return loaderDelayFn(() =>
    ensureInvoices().then(() => {
      const invoice = invoices.find((d) => d.id === id)
      if (!invoice) {
        throw new Error('Invoice not found')
      }
      return invoice
    }),
  )
}

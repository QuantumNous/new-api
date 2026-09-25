import * as TanstackStart from '@tanstack/react-start'

const serverFunc = TanstackStart.createServerOnlyFn(() => 'server')

const clientFunc = TanstackStart.createClientOnlyFn(() => 'client')

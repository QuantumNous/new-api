import {
  createServerOnlyFn as serverFn,
  createClientOnlyFn as clientFn,
} from '@tanstack/react-start'

const serverFunc = serverFn(() => 'server')

const clientFunc = clientFn(() => 'client')

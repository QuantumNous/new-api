import { createServerOnlyFn, createClientOnlyFn } from '@tanstack/react-start'

const serverFunc = createServerOnlyFn(() => 'server')

const clientFunc = createClientOnlyFn(() => 'client')

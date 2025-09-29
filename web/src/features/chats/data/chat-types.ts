import { type conversations } from './convo.json'

export type ChatUser = (typeof conversations)[number]
export type Convo = ChatUser['messages'][number]

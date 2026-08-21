import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

crons.cron('clear messages table', '0,20,40 * * * *', internal.board.clear)

export default crons

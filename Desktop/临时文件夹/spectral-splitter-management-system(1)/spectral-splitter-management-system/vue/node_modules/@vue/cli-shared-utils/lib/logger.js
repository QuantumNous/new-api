const chalk = require('chalk')
const stripAnsi = require('strip-ansi')
const readline = require('readline')
const EventEmitter = require('events')

const { stopSpinner } = require('./spinner')

exports.events = new EventEmitter()

function _log (type, tag, message) {
  if (process.env.VUE_CLI_API_MODE && message) {
    exports.events.emit('log', {
      message,
      type,
      tag
    })
  }
}

const format = (label, msg) => {
  return msg.split('\n').map((line, i) => {
    return i === 0
      ? `${label} ${line}`
      : line.padStart(stripAnsi(label).length + line.length + 1)
  }).join('\n')
}

const chalkTag = msg => chalk.bgBlackBright.white.dim(` ${msg} `)

exports.log = (msg = '', tag = null) => {
  tag ? console.log(format(chalkTag(tag), msg)) : console.log(msg)
  _log('log', tag, msg)
}

exports.info = (msg, tag = null) => {
  console.log(format(chalk.bgBlue.black(' INFO ') + (tag ? chalkTag(tag) : ''), msg))
  _log('info', tag, msg)
}

exports.done = (msg, tag = null) => {
  console.log(format(chalk.bgGreen.black(' DONE ') + (tag ? chalkTag(tag) : ''), msg))
  _log('done', tag, msg)
}

exports.warn = (msg, tag = null) => {
  console.warn(format(chalk.bgYellow.black(' WARN ') + (tag ? chalkTag(tag) : ''), chalk.yellow(msg)))
  _log('warn', tag, msg)
}

exports.error = (msg, tag = null) => {
  stopSpinner()
  console.error(format(chalk.bgRed(' ERROR ') + (tag ? chalkTag(tag) : ''), chalk.red(msg)))
  _log('error', tag, msg)
  if (msg instanceof Error) {
    console.error(msg.stack)
    _log('error', tag, msg.stack)
  }
}

exports.clearConsole = title => {
  if (process.stdout.isTTY) {
    const blank = '\n'.repeat(process.stdout.rows)
    console.log(blank)
    readline.cursorTo(process.stdout, 0, 0)
    readline.clearScreenDown(process.stdout)
    if (title) {
      console.log(title)
    }
  }
}

// silent all logs except errors during tests and keep record
if (process.env.VUE_CLI_TEST) {
  require('./_silence')('logs', exports)
}

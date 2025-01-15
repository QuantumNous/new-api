/* @flow */

import type Router from '../index'
import { History } from './base'
import { NavigationFailureType, isNavigationFailure } from '../util/errors'

export class AbstractHistory extends History {
  index: number
  stack: Array<Route>

  constructor (router: Router, base: ?string) {
    super(router, base)
    this.stack = []
    this.index = -1
  }

  push (location: RawLocation, onComplete?: Function, onAbort?: Function) {
    this.transitionTo(
      location,
      route => {
        this.stack = this.stack.slice(0, this.index + 1).concat(route)
        this.index++
        onComplete && onComplete(route)
      },
      onAbort
    )
  }

  replace (location: RawLocation, onComplete?: Function, onAbort?: Function) {
    this.transitionTo(
      location,
      route => {
        this.stack = this.stack.slice(0, this.index).concat(route)
        onComplete && onComplete(route)
      },
      onAbort
    )
  }

  go (n: number) {
    const targetIndex = this.index + n
    if (targetIndex < 0 || targetIndex >= this.stack.length) {
      return
    }
    const route = this.stack[targetIndex]
    this.confirmTransition(
      route,
      () => {
        const prev = this.current
        this.index = targetIndex
        this.updateRoute(route)
        this.router.afterHooks.forEach(hook => {
          hook && hook(route, prev)
        })
      },
      err => {
        if (isNavigationFailure(err, NavigationFailureType.duplicated)) {
          this.index = targetIndex
        }
      }
    )
  }

  getCurrentLocation () {
    const current = this.stack[this.stack.length - 1]
    return current ? current.fullPath : '/'
  }

  ensureURL () {
    // noop
  }
}

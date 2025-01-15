import VueRouter from '../router'

export const version = '__VERSION__'
export { isNavigationFailure, NavigationFailureType } from '../util/errors'
export { START as START_LOCATION } from '../util/route'
export { default as RouterLink } from '../components/link'
export { default as RouterView } from '../components/view'

// we can't add the other composables here because people could still be using an older version of vue and that would
// create a compilation error trying to import from vue

export default VueRouter

/**
 * Augment the typings of Vue.js
 */

import Vue from 'vue'
import VueRouter, { Route, NavigationGuard } from './index'

declare module 'vue/types/vue' {
  interface Vue {
    $router: VueRouter
    $route: Route
  }
}

declare module 'vue/types/options' {
  interface ComponentOptions<V extends Vue> {
    router?: VueRouter
    beforeRouteEnter?: NavigationGuard<V>
    beforeRouteLeave?: NavigationGuard<V>
    beforeRouteUpdate?: NavigationGuard<V>
  }
}

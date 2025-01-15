import { createRouter<%
  if (historyMode) {
    %>, createWebHistory<%
  } else {
    %>, createWebHashHistory<%
  }

  if (hasTypeScript) {
    %>, RouteRecordRaw<%
  }
  %> } from 'vue-router'
import HomeView from '../views/HomeView.vue'

const routes<% if (hasTypeScript) { %>: Array<RouteRecordRaw><% } %> = [
  {
    path: '/',
    name: 'home',
    component: HomeView
  },
  {
    path: '/about',
    name: 'about',
    // route level code-splitting
    // this generates a separate chunk (about.[hash].js) for this route
    // which is lazy-loaded when the route is visited.
    <%_ if (doesCompile) { _%>
    component: () => import(/* webpackChunkName: "about" */ '../views/AboutView.vue')
    <%_ } else { _%>
    component: function () {
      return import(/* webpackChunkName: "about" */ '../views/AboutView.vue')
    }
    <%_ } _%>
  }
]

const router = createRouter({
  <%_ if (historyMode) { _%>
  history: createWebHistory(process.env.BASE_URL),
  <%_ } else { _%>
  history: createWebHashHistory(),
  <%_ } _%>
  routes
})

export default router

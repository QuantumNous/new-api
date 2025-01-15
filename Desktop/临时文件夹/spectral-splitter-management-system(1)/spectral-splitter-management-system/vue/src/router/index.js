import Vue from 'vue'
import VueRouter from 'vue-router'

Vue.use(VueRouter)

// 解决导航栏或者底部导航tabBar中的vue-router在3.0版本以上频繁点击菜单报错的问题。
const originalPush = VueRouter.prototype.push
VueRouter.prototype.push = function push (location) {
  return originalPush.call(this, location).catch(err => err)
}

const routes = [
  {
    path: '/',
    name: 'Manager',
    component: () => import('../views/Manager.vue'),
    redirect: '/home',
    children: [
      { path: '403', name: 'NoAuth', meta: { name: '无权限' }, component: () => import('../views/manager/403') },
      { path: 'home', name: 'Home', meta: { name: '系统首页' }, component: () => import('../views/manager/Home') },

      { path: 'admin', name: 'Admin', meta: { name: '管理员信息' }, component: () => import('../views/manager/Admin') },
      { path: 'user', name: 'User', meta: { name: '客户经理' }, component: () => import('../views/manager/User') },
      { path: 'iam', name: 'Iam', meta: { name: '装维' }, component: () => import('../views/manager/Iam') },
      { path: 'cuser', name: 'Cuser', meta: { name: '资源中心用户' }, component: () => import('../views/manager/Cuser') },

      { path: 'adminPerson', name: 'AdminPerson', meta: { name: '个人信息' }, component: () => import('../views/manager/AdminPerson') },
      { path: 'userPerson', name: 'UserPerson', meta: { name: '个人信息' }, component: () => import('../views/manager/UserPerson') },
      { path: 'iamPerson', name: 'IamPerson', meta: { name: '个人信息' }, component: () => import('../views/manager/IamPerson') },
      { path: 'cuserPerson', name: 'CuserPerson', meta: { name: '个人信息' }, component: () => import('../views/manager/CuserPerson') },
      { path: 'password', name: 'Password', meta: { name: '修改密码' }, component: () => import('../views/manager/Password') },

      { path: 'centrality', name: 'Centrality', meta: { name: '资源中心' }, component: () => import('../views/manager/Centrality') },
      { path: 'equipment', name: 'Equipment', meta: { name: '分光器信息' }, component: () => import('../views/manager/Equipment') },
      { path: 'orders', name: 'Orders', meta: { name: '工单信息' }, component: () => import('../views/manager/Orders') },
      { path: 'userOrders', name: 'UserOrders', meta: { name: '工单信息' }, component: () => import('../views/manager/UserOrders') },
      { path: 'iamOrders', name: 'IamOrders', meta: { name: '工单信息' }, component: () => import('../views/manager/IamOrders') },
      { path: 'customer', name: 'Customer', meta: { name: '客户信息' }, component: () => import('../views/manager/Customer') },
    ]
  },
  { path: '/login', name: 'Login', meta: { name: '登录' }, component: () => import('../views/Login.vue') },
  { path: '*', name: 'NotFound', meta: { name: '无法访问' }, component: () => import('../views/404.vue') },
]

const router = new VueRouter({
  mode: 'history',
  base: process.env.BASE_URL,
  routes
})

export default router

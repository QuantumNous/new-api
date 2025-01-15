<template>
  <div class="manager-container">
    <div class="manager-header">
      <div class="manager-header-left">
        <div class="title" style="text-align: center">分光器管理系统</div>
      </div>

      <div class="manager-header-center">
        <el-breadcrumb separator-class="el-icon-arrow-right">
          <el-breadcrumb-item :to="{ path: '/' }">首页</el-breadcrumb-item>
          <el-breadcrumb-item :to="{ path: $route.path }">{{ $route.meta.name }}</el-breadcrumb-item>
        </el-breadcrumb>
      </div>

      <div class="manager-header-right">
        <el-dropdown placement="bottom">
          <div class="avatar">
            <img :src="user.avatar || require('@/assets/imgs/defaultAvatar.png')" />
            <div>{{ user.name || user.username }}</div>
          </div>
          <el-dropdown-menu slot="dropdown">
            <el-dropdown-item @click.native="goToPerson">个人信息</el-dropdown-item>
            <el-dropdown-item @click.native="$router.push('/password')">修改密码</el-dropdown-item>
            <el-dropdown-item @click.native="logout">退出登录</el-dropdown-item>
          </el-dropdown-menu>
        </el-dropdown>
      </div>
    </div>

    <div class="manager-main">
      <div class="manager-main-left">
        <el-menu :default-openeds="['info', 'user']" router style="border: none" :default-active="$route.path">
          <el-menu-item index="/home">
            <i class="el-icon-s-home"></i>
            <span slot="title">系统首页</span>
          </el-menu-item>
          <el-submenu index="info">
            <template slot="title">
              <i class="el-icon-menu"></i><span>信息管理</span>
            </template>
            <el-menu-item index="/customer" v-if="user.role === 'ADMIN'">客户信息</el-menu-item>
            <el-menu-item index="/equipment" v-if="user.role === 'ADMIN'">分光器信息</el-menu-item>
            <el-menu-item index="/orders" v-if="user.role === 'ADMIN'">工单信息</el-menu-item>
            <el-menu-item index="/centrality" v-if="user.role === 'ADMIN' || user.role === 'CUSER'">资源中心</el-menu-item>
            <el-menu-item index="/userOrders" v-if="user.role === 'USER'">我的工单</el-menu-item>
            <el-menu-item index="/iamOrders" v-if="user.role === 'IAM'">我的工单</el-menu-item>
          </el-submenu>

          <el-submenu index="user" v-if="user.role === 'ADMIN'">
            <template slot="title">
              <i class="el-icon-menu"></i><span>用户管理</span>
            </template>
            <el-menu-item index="/admin">管理员</el-menu-item>
            <el-menu-item index="/user">客户经理</el-menu-item>
            <el-menu-item index="/iam">装维</el-menu-item>
            <el-menu-item index="/cuser">资源中心用户</el-menu-item>
          </el-submenu>
        </el-menu>
      </div>

      <div class="manager-main-right">
        <router-view @update:user="updateUser" />
      </div>
    </div>

  </div>
</template>

<script>
export default {
  name: "Manager",
  data() {
    return {
      user: JSON.parse(sessionStorage.getItem('sys-user') || '{}'),
    }
  },
  created() {
    if (!this.user.id) {
      this.$router.push('/login')
    }
  },
  methods: {
    updateUser() {
      this.user = JSON.parse(sessionStorage.getItem('sys-user') || '{}')
    },
    goToPerson() {
      if (this.user.role === 'ADMIN') {
        this.$router.push('/adminPerson')
      }
      if (this.user.role === 'USER') {
        this.$router.push('/userPerson')
      }
      if (this.user.role === 'IAM') {
        this.$router.push('/iamPerson')
      }
      if (this.user.role === 'CUSER') {
        this.$router.push('/cuserPerson')
      }
    },
    logout() {
      sessionStorage.removeItem('sys-user')
      this.$router.push('/login')
    }
  }
}
</script>

<style scoped>
@import "@/assets/css/manager.css";
</style>
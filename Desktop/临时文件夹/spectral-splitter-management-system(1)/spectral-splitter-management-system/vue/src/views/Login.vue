<template>
  <div class="container">
    <div style="width: 500px; padding: 30px; background-color: rgba(255, 255, 255, 0.8); border-radius: 15px;">
      <div style="text-align: center; font-size: 24px; margin-bottom: 20px; color: #333;font-weight: bold">分光器管理系统</div>
      <el-form :model="form" :rules="rules" ref="formRef">
        <el-form-item prop="username">
          <el-input prefix-icon="el-icon-user" size="medium" placeholder="请输入账号" v-model="form.username"></el-input>
        </el-form-item>
        <el-form-item prop="password">
          <el-input prefix-icon="el-icon-lock" size="medium" placeholder="请输入密码" show-password
                    v-model="form.password"></el-input>
        </el-form-item>
        <el-form-item prop="role">
          <el-radio-group v-model="form.role">
            <el-radio label="ADMIN">管理员</el-radio>
            <el-radio label="USER">客户经理</el-radio>
            <el-radio label="IAM">装维经理</el-radio>
            <el-radio label="CUSER">资源中心</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item>
          <el-button type="info" size="medium" style="width: 100%;" @click="login">登 录</el-button>
        </el-form-item>
      </el-form>
    </div>
  </div>
</template>

<script>
export default {
  name: "Login",
  data() {
    return {
      form: {role: 'ADMIN'},
      rules: {
        username: [{required: true, message: '请输入账号', trigger: 'blur'},],
        password: [{required: true, message: '请输入密码', trigger: 'blur'},],
      }
    }
  },
  created() {
  },
  methods: {
    login() {
      this.$refs['formRef'].validate((valid) => {
        if (valid) {
          this.$request.post('/login', this.form).then(res => {
            if (res.code === '200') {
              this.$message.success('登录成功')
              sessionStorage.setItem("sys-user", JSON.stringify(res.data))
              this.$router.push('/')
            } else {
              this.$message.error(res.msg)
            }
          })
        }
      })
    },
  }
}
</script>

<style scoped>
.container {
  height: 100vh;
  overflow: hidden;
  background-image: url("@/assets/imgs/bg.jpg");
  background-size: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666;
}
</style>
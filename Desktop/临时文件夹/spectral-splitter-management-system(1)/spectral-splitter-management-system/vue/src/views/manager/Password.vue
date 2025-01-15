<template>
  <div>
    <el-card style="width: 40%;margin: 30px auto">
      <el-form ref="formRef" :model="user" :rules="rules" label-width="100px" style="padding-right: 50px">
        <el-form-item label="原始密码" prop="password">
          <el-input show-password v-model="user.password" placeholder="原始密码"></el-input>
        </el-form-item>
        <el-form-item label="新密码" prop="newPassword">
          <el-input show-password v-model="user.newPassword" placeholder="新密码"></el-input>
        </el-form-item>
        <el-form-item label="确认新密码" prop="confirmPassword">
          <el-input show-password v-model="user.confirmPassword" placeholder="确认密码"></el-input>
        </el-form-item>
        <div style="text-align: center; margin-bottom: 20px">
          <el-button type="info" plain @click="update">确认修改</el-button>
        </div>
      </el-form>
    </el-card>
  </div>
</template>

<script>
export default {
  name: "Password",
  data() {
    const validatePassword = (rule, value, callback) => {
      if (value === '') {
        callback(new Error('请确认密码'))
      } else if (value !== this.user.newPassword) {
        callback(new Error('确认密码错误'))
      } else {
        callback()
      }
    }

    return {
      user: JSON.parse(sessionStorage.getItem('sys-user') || '{}'),
      rules: {
        password: [{ required: true, message: '请输入原始密码', trigger: 'blur' }, ],
        newPassword: [ { required: true, message: '请输入新密码', trigger: 'blur' },],
        confirmPassword: [{ validator: validatePassword, required: true, trigger: 'blur' },],
      }
    }
  },
  created() {

  },
  methods: {
    update() {
      this.$refs.formRef.validate((valid) => {
        if (valid) {
          this.$request.put('/updatePassword', this.user).then(res => {
            if (res.code === '200') {
              sessionStorage.removeItem('sys-user')
              this.$message.success('修改密码成功')
              this.$router.push('/login')
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
/deep/.el-form-item__label {
  font-weight: bold;
}
</style>
<template>
  <div>
    <el-card style="width: 50%;margin: 30px auto">
      <el-form :model="user" label-width="100px" style="padding-right: 50px" :rules="rules" ref="formRef">
        <div style="margin: 15px; text-align: center">
          <el-upload
              class="avatar-uploader"
              :action="$baseUrl + '/files/upload'"
              :show-file-list="false"
              :on-success="handleAvatarSuccess"
          >
            <img v-if="user.avatar" :src="user.avatar" class="avatar"/>
            <i v-else class="el-icon-plus avatar-uploader-icon"></i>
          </el-upload>
        </div>
        <el-form-item label="用户名" prop="username">
          <el-input v-model="user.username" placeholder="用户名" disabled></el-input>
        </el-form-item>
        <el-form-item label="姓名" prop="name">
          <el-input v-model="user.name" placeholder="姓名"></el-input>
        </el-form-item>
        <el-form-item label="电话" prop="phone">
          <el-input v-model="user.phone" placeholder="电话"></el-input>
        </el-form-item>
        <el-form-item label="邮箱" prop="email">
          <el-input v-model="user.email" placeholder="邮箱"></el-input>
        </el-form-item>
        <div style="text-align: center; margin-bottom: 20px">
          <el-button type="info" plain @click="update">保 存</el-button>
        </div>
      </el-form>
    </el-card>
  </div>
</template>

<script>
export default {
  name: "IamPerson",
  data() {
    return {
      user: JSON.parse(sessionStorage.getItem('sys-user') || '{}'),
      rules: {
        name: [{required: true, message: '请输入姓名', trigger: 'blur'},],
        phone: [{pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确', trigger: 'blur'}],
        email: [{type: 'email', message: '邮箱格式不正确', trigger: 'blur'}],
      },
    }
  },
  created() {

  },
  methods: {
    update() {
      this.$refs.formRef.validate((valid) => {
        if (valid) {
          this.$request.put('/iam/update', this.user).then(res => {
            if (res.code === '200') {
              this.$message.success('保存成功')
              sessionStorage.setItem('sys-user', JSON.stringify(this.user))
              this.$emit('update:user')
            } else {
              this.$message.error(res.msg)
            }
          })
        }
      })
    },
    handleAvatarSuccess(response, file, fileList) {
      this.$set(this.user, 'avatar', response.data)
    },
  }
}
</script>

<style scoped>
/deep/ .el-form-item__label {
  font-weight: bold;
}

/deep/ .el-upload {
  border-radius: 50%;
}

/deep/ .avatar-uploader .el-upload {
  border: 1px dashed #d9d9d9;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  border-radius: 50%;
}

/deep/ .avatar-uploader .el-upload:hover {
  border-color: #409EFF;
}

.avatar-uploader-icon {
  font-size: 28px;
  color: #8c939d;
  width: 120px;
  height: 120px;
  line-height: 120px;
  text-align: center;
  border-radius: 50%;
}

.avatar {
  width: 120px;
  height: 120px;
  display: block;
  border-radius: 50%;
}
</style>
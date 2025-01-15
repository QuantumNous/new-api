<template>
  <div>
    <div class="search">
      <el-input placeholder="查询账号" style="width: 200px;" v-model="username"></el-input>
      <el-input placeholder="查询姓名" style="width: 200px;margin-left: 10px;" v-model="name"></el-input>
      <el-button type="info" plain style="margin-left: 10px;" @click="load(1)">查询</el-button>
      <el-button type="warning" plain style="margin-left: 10px;" @click="reset">重置</el-button>
    </div>

    <div class="operation">
      <el-button type="primary" plain @click="handleAdd">添加</el-button>
      <el-button type="danger" plain @click="delBatch">批量删除</el-button>
    </div>

    <div class="table">
      <el-table :data="tableData" strip @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="55" align="center"></el-table-column>
        <el-table-column prop="username" label="账号"></el-table-column>
        <el-table-column prop="name" label="姓名"></el-table-column>
        <el-table-column prop="phone" label="电话"></el-table-column>
        <el-table-column prop="email" label="邮箱"></el-table-column>
        <el-table-column label="头像">
          <template v-slot="scope">
            <div style="display: flex; align-items: center">
              <el-image style="width: 40px; height: 40px; border-radius: 50%"
                        :src="scope.row.avatar || require('@/assets/imgs/defaultAvatar.png')"
                        :preview-src-list="[scope.row.avatar || require('@/assets/imgs/defaultAvatar.png')]"></el-image>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="操作" align="center" width="180">
          <template v-slot="scope">
            <el-button size="mini" type="primary" plain @click="handleEdit(scope.row)">编辑</el-button>
            <el-button size="mini" type="danger" plain @click="del(scope.row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="pagination">
        <el-pagination
            background
            @current-change="handleCurrentChange"
            :current-page="pageNum"
            :page-sizes="[5, 10, 20]"
            :page-size="pageSize"
            layout="total, prev, pager, next"
            :total="total">
        </el-pagination>
      </div>
    </div>

    <el-dialog title="客户经理" :visible.sync="fromVisible" width="40%" :close-on-click-modal="false" destroy-on-close>
      <el-form :model="form" label-width="100px" style="padding-right: 50px" :rules="rules" ref="formRef">
        <div style="margin-bottom: 20px">
          <el-upload
              style="display: flex;justify-content: center"
              :action="$baseUrl + '/files/upload'"
              :headers="{ token: user.token }"
              list-type="picture"
              :show-file-list="false"
              :on-success="handleFilesSuccess"
          >
            <el-image
                style="width: 100px; height: 100px; border-radius: 50%;object-fit: cover; border: 1px dashed #d9d9d9;"
                :src="form.avatar || require('@/assets/imgs/defaultAvatar.png')"></el-image>
          </el-upload>
        </div>
        <el-form-item label="用户名" prop="username">
          <el-input v-model="form.username" placeholder="用户名"></el-input>
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input v-model="form.password" placeholder="密码"></el-input>
        </el-form-item>
        <el-form-item label="姓名" prop="name">
          <el-input v-model="form.name" placeholder="姓名"></el-input>
        </el-form-item>
        <el-form-item label="电话" prop="phone">
          <el-input v-model="form.phone" placeholder="电话"></el-input>
        </el-form-item>
        <el-form-item label="邮箱" prop="email">
          <el-input v-model="form.email" placeholder="邮箱"></el-input>
        </el-form-item>
      </el-form>
      <div slot="footer" class="dialog-footer">
        <el-button @click="fromVisible = false">取 消</el-button>
        <el-button type="primary" @click="save">确 定</el-button>
      </div>
    </el-dialog>

  </div>
</template>
<script>
export default {
  name: "Cuser",
  data() {
    return {
      user: JSON.parse(sessionStorage.getItem('sys-user') || '{}'),

      tableData: [],
      pageNum: 1,
      pageSize: 10,
      total: 0,

      username: null,
      name: null,

      fromVisible: false,
      form: {},
      ids: [],

      rules: {
        username: [{required: true, message: '请输入账号', trigger: 'blur'},],
        password: [{required: true, message: '请输入密码', trigger: 'blur'},],
        name: [{ required: true, message: "请输入姓名", trigger: "blur" },],
        phone: [{ pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确', trigger: 'blur' }],
        email: [ { type: 'email', message: '邮箱格式不正确', trigger: 'blur' }],
      },
    }
  },
  created() {
    this.load(1)
  },
  methods: {
    load(pageNum) {
      if (pageNum) this.pageNum = pageNum
      this.$request.get('/cuser/selectPage', {
        params: {
          pageNum: this.pageNum,
          pageSize: this.pageSize,
          username: this.username,
          name: this.name,
        }
      }).then(res => {
        if (res.code === '200') {
          this.tableData = res.data?.list
          this.total = res.data?.total
        } else {
          this.$message.error(res.msg)
        }
      })
    },
    reset() {
      this.username = null
      this.name = null
      this.load(1)
    },
    handleAdd() {
      this.form = {}
      this.fromVisible = true
    },
    handleEdit(row) {
      this.form = JSON.parse(JSON.stringify(row))
      this.fromVisible = true
    },
    save() {
      this.$refs.formRef.validate((valid) => {
        if (valid) {
          this.$request({
            url: this.form.id ? '/cuser/update' : '/cuser/add',
            method: this.form.id ? 'PUT' : 'POST',
            data: this.form
          }).then(res => {
            if (res.code === '200') {
              this.$message.success('保存成功')
              this.load(1)
              this.fromVisible = false
            } else {
              this.$message.error(res.msg)
            }
          })
        }
      })
    },
    del(id) {
      this.$confirm('您确定删除吗？', '确认删除', {type: "warning"}).then(response => {
        this.$request.delete('/cuser/delete/' + id).then(res => {
          if (res.code === '200') {
            this.$message.success('操作成功')
            this.load(1)
          } else {
            this.$message.error(res.msg)
          }
        })
      }).catch(() => {
      })
    },
    delBatch() {
      if (!this.ids.length) {
        this.$message.warning('请选择数据')
        return
      }
      this.$confirm('您确定批量删除这些数据吗？', '确认删除', {type: "warning"}).then(response => {
        this.$request.delete('/cuser/delete/batch', {data: this.ids}).then(res => {
          if (res.code === '200') {
            this.$message.success('操作成功')
            this.load(1)
          } else {
            this.$message.error(res.msg)
          }
        })
      }).catch(() => {
      })
    },
    handleSelectionChange(rows) {
      this.ids = rows.map(v => v.id)
    },
    handleCurrentChange(pageNum) {
      this.load(pageNum)
    },
    handleFilesSuccess(response, file, fileList) {
      this.$forceUpdate();
      this.form.avatar = response.data
    },
  }
}
</script>

<style scoped>

</style>
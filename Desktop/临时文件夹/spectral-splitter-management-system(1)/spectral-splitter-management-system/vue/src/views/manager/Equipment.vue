<template>
  <div>
    <div class="search">
      <el-input placeholder="查询OLT编码" style="width: 200px;" v-model="oltCode"></el-input>
      <el-button type="info" plain style="margin-left: 10px;" @click="load(1)">查询</el-button>
      <el-button type="warning" plain style="margin-left: 10px;" @click="reset">重置</el-button>
    </div>

    <div class="operation">
      <el-button type="primary" plain @click="handleAdd">添加分光器</el-button>
      <el-button type="danger" plain @click="delBatch">批量删除</el-button>
    </div>

    <div class="table">
      <el-table :data="tableData" stripe @selection-change="handleSelectionChange" >
        <el-table-column type="selection" width="55" align="center"></el-table-column>
        <el-table-column type="expand" label="客户信息" width="120">
          <template slot-scope="scope">
            <div style="padding: 20px">
              <div style="display: flex;align-items: center">
                <div style="font-size: 20px;font-weight: bold;">客户信息</div>
                <el-button type="info" plain style="margin-left: 10px;" @click="handleAdd2(scope.row.id)">添加客户</el-button>
              </div>
              <div v-if="scope.row.equipmentCustomerList.length > 0">
                <div v-for="(item,index) in scope.row.equipmentCustomerList" :key="index"
                     style="display: flex;margin: 10px 0;font-size: 16px;align-items: center">
                  <div style="width: 300px">姓名：{{ item?.customer?.name }}</div>
                  <div style="width: 300px">手机号：{{ item?.customer?.phone }}</div>
                  <div style="flex: 1">地址：{{ item?.customer?.address }}</div>
                  <div style="width: 200px">
                    <el-button type="danger" plain @click=customerDel(item.id)>删除</el-button>
                  </div>
                </div>
              </div>
              <el-empty v-else description="没有客户"></el-empty>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="oltCode" label="OLT编码"></el-table-column>
        <el-table-column prop="oltName" label="OLT名称"></el-table-column>
        <el-table-column prop="area" label="区域"></el-table-column>
        <el-table-column prop="classify" label="业务类型"></el-table-column>
        <el-table-column label="操作" width="250" align="center">
          <template v-slot="scope">
            <el-button plain type="info" @click="handleOrder(scope.row)" size="mini">生成工单</el-button>
            <el-button plain type="primary" @click="handleEdit(scope.row)" size="mini">编辑</el-button>
            <el-button plain type="danger" size="mini" @click=del(scope.row.id)>删除</el-button>
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

    <el-dialog title="分光器信息" :visible.sync="fromVisible" width="40%" :close-on-click-modal="false"
               destroy-on-close>
      <el-form label-width="100px" style="padding-right: 50px" :model="form" :rules="rules" ref="formRef">
        <el-form-item prop="oltCode" label="OLT编码">
          <el-input v-model="form.oltCode" autocomplete="off"></el-input>
        </el-form-item>
        <el-form-item prop="oltName" label="OLT名称">
          <el-input v-model="form.oltName" autocomplete="off"></el-input>
        </el-form-item>
        <el-form-item prop="area" label="区域">
          <el-input v-model="form.area" autocomplete="off"></el-input>
        </el-form-item>
        <el-form-item prop="classify" label="业务类型">
          <el-input v-model="form.classify" autocomplete="off"></el-input>
        </el-form-item>
      </el-form>
      <div slot="footer" class="dialog-footer">
        <el-button @click="fromVisible = false">取 消</el-button>
        <el-button type="primary" @click="save">确 定</el-button>
      </div>
    </el-dialog>

    <el-dialog title="添加客户" :visible.sync="fromVisible2" width="40%" :close-on-click-modal="false"
               destroy-on-close>
      <el-form label-width="100px" style="padding-right: 50px" :model="form2" :rules="rules2" ref="formRef">
        <el-form-item prop="customerId" label="客户">
          <el-select v-model="form2.customerId" style="width: 300px" filterable>
            <el-option v-for="(item,index) in customers" :key="index" :label="item.name + ' - ' + item.phone" :value="item.id">
            </el-option>
          </el-select>
        </el-form-item>
      </el-form>
      <div slot="footer" class="dialog-footer">
        <el-button @click="fromVisible2 = false">取 消</el-button>
        <el-button type="primary" @click="customerSave">确 定</el-button>
      </div>
    </el-dialog>

    <el-dialog title="生成工单" :visible.sync="fromVisible3" width="40%" :close-on-click-modal="false"
               destroy-on-close>
      <el-form label-width="100px" style="padding-right: 50px" :model="form3" :rules="rules3" ref="formRef">
        <div v-for="(item,index) in form3.equipmentCustomerList" :key="index">
          <el-form-item :label="'客户' + (index + 1)">
             {{item.customer.name}}
          </el-form-item>
          <el-form-item label="客户经理">
            <el-select v-model="item.userId" style="width: 300px" filterable>
              <el-option v-for="(item,index) in users" :key="index" :label="item.name" :value="item.id">
              </el-option>
            </el-select>
          </el-form-item>
        </div>
      </el-form>
      <div slot="footer" class="dialog-footer">
        <el-button @click="fromVisible3 = false">取 消</el-button>
        <el-button type="primary" @click="createOrder()">生成工单</el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script>
export default {
  name: "Equipment",
  data() {
    return {
      user: JSON.parse(sessionStorage.getItem('sys-user') || '{}'),

      tableData: [],
      pageNum: 1,
      pageSize: 10,
      total: 0,

      oltCode: null,

      customers: [],
      users: [],
      iams: [],

      fromVisible: false,
      form: {},
      ids: [],

      rules: {
        oltCode: [{required: true, message: '必填项', trigger: 'blur'},],
        oltName: [{required: true, message: '必填项', trigger: 'blur'},]
      },

      fromVisible2: false,
      form2: {},
      rules2: {
        customerId: [{required: true, message: '必填项', trigger: 'blur'},],
      },

      fromVisible3: false,
      form3: {},
      rules3: {
        userId: [{required: true, message: '必填项', trigger: 'blur'},],
      },

    }
  },
  created() {
    this.load(1)
  },
  methods: {
    load(pageNum) {
      if (pageNum) this.pageNum = pageNum
      this.$request.get('/equipment/selectPage', {
        params: {
          pageNum: this.pageNum,
          pageSize: this.pageSize,
          oltCode: this.oltCode,
        }
      }).then(res => {
        this.tableData = res.data?.list
        this.total = res.data?.total
      })

      this.$request.get('/customer/selectAll').then(res => {
        this.customers = res.data
      })
      this.$request.get('/user/selectAll').then(res => {
        this.users = res.data
      })
      this.$request.get('/iam/selectAll').then(res => {
        this.iams = res.data
      })
    },
    reset() {
      this.oltCode = null
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
            url: this.form.id ? '/equipment/update' : '/equipment/add',
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
        this.$request.delete('/equipment/delete/' + id).then(res => {
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
        this.$request.delete('/equipment/delete/batch', {data: this.ids}).then(res => {
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

    handleAdd2(id) {
      this.form2 = {
        equipmentId: id
      }
      this.fromVisible2 = true
    },
    customerSave() {
      this.$refs.formRef.validate((valid) => {
        if (valid) {
          this.$request({
            url: '/equipmentCustomer/add',
            method: 'POST',
            data: this.form2
          }).then(res => {
            if (res.code === '200') {
              this.$message.success('保存成功')
              this.load(1)
              this.fromVisible2 = false
            } else {
              this.$message.error(res.msg)
            }
          })
        }
      })
    },
    customerDel(id) {
      this.$confirm('您确定删除吗？', '确认删除', {type: "warning"}).then(response => {
        this.$request.delete('/equipmentCustomer/delete/' + id).then(res => {
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
    handleOrder(row) {
      this.form3 = JSON.parse(JSON.stringify(row))
      this.fromVisible3 = true
    },
    createOrder(){
      // 检查每个客户经理的 userId 是否都有值
      let allUserIdsValid = this.form3.equipmentCustomerList.every(item => item.userId);

      if (!allUserIdsValid) {
        this.$message.error('请为所有客户指定客户经理');
        return;
      }

      this.$refs.formRef.validate((valid) => {
        if (valid) {
          this.$request({
            url: '/equipment/createOrder',
            method: 'POST',
            data: this.form3
          }).then(res => {
            if (res.code === '200') {
              this.$message.success('创建成功')
              this.load(1)
              this.fromVisible3 = false
            } else {
              this.$message.error(res.msg)
            }
          })
        }
      })
    }
  }
}
</script>

<style scoped>

</style>
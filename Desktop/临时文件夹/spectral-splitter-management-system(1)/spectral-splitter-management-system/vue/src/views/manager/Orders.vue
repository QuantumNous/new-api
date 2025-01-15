<template>
  <div>
    <div class="search">
      <el-input placeholder="查询工单" style="width: 200px;" v-model="orderSn"></el-input>
      <el-button type="info" plain style="margin-left: 10px;" @click="load(1)">查询</el-button>
      <el-button type="warning" plain style="margin-left: 10px;" @click="reset">重置</el-button>
    </div>

    <div class="operation">
      <el-button type="danger" plain @click="delBatch">批量删除</el-button>
    </div>

    <div class="table">
      <el-table :data="tableData" stripe @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="55" align="center"></el-table-column>
        <el-table-column type="expand" label="工单内容" width="120">
          <template slot-scope="scope" >
            <div v-if="scope.row.subOrdersList.length > 0" style="padding: 20px">
              <div v-for="(item,index) in scope.row.subOrdersList" :key="index"
                   style="display: flex;margin: 10px 0;font-size: 16px;align-items: center">
                <div style="width: 200px">客户：{{ item?.customer?.name }}</div>
                <div style="width: 300px">客户经理：{{ item?.user?.name }}</div>
                <div style="width: 300px">割接时间：{{ item?.repairTime }}</div>
                <div style="width: 300px">装维：{{ item?.iam?.name }}</div>
                <div style="width: 300px">装维反馈：{{ item?.iamContent }}</div>
                <div style="width: 300px">
                  状态：
                  <el-tag type="warning" v-if="item.state === 1">等待客户经理反馈</el-tag>
                  <el-tag type="danger" v-if="item.state === 2">待分配装维</el-tag>
                  <el-tag type="info" v-if="item.state === 3">等待装维反馈</el-tag>
                  <el-tag type="success" v-if="item.state === 4">已完成</el-tag>
                </div>
                <div style="width: 200px">
                  <el-button type="info" plain v-if="item.state === 2" @click="selectIam(item)">分配装维</el-button>
                </div>
              </div>
            </div>
            <el-empty v-else description="没有内容"></el-empty>
          </template>
        </el-table-column>
        <el-table-column prop="orderSn" label="工单号"></el-table-column>
        <el-table-column prop="equipment.oltCode" label="OLT编码"></el-table-column>
        <el-table-column prop="subOrdersList.length" label="客户数量"></el-table-column>
        <el-table-column prop="startTime" label="开始时间"></el-table-column>
        <el-table-column prop="content" label="备注"></el-table-column>
        <el-table-column prop="state" label="状态">
          <template slot-scope="scope" >
            <el-tag type="warning" v-if="scope.row.state === 1">进行中</el-tag>
            <el-tag type="danger" v-if="scope.row.state === 2">已完成</el-tag>
            <el-tag type="info" v-if="scope.row.state === 3">已发送到资源中心</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="250" align="center">
          <template v-slot="scope">
            <el-button plain type="info" @click="sendCenter(scope.row)" size="mini" v-if="scope.row.state === 2">发送</el-button>
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

    <el-dialog title="工单信息" :visible.sync="fromVisible" width="40%" :close-on-click-modal="false" destroy-on-close>
      <el-form label-width="100px" style="padding-right: 50px" :model="form" :rules="rules" ref="formRef">
        <el-form-item prop="content" label="备注">
          <el-input v-model="form.content" type="textarea" autosize autocomplete="off"></el-input>
        </el-form-item>
      </el-form>
      <div slot="footer" class="dialog-footer">
        <el-button @click="fromVisible = false">取 消</el-button>
        <el-button type="primary" @click="save">确 定</el-button>
      </div>
    </el-dialog>

    <el-dialog title="子工单" :visible.sync="fromVisible2" width="40%" :close-on-click-modal="false" destroy-on-close>
      <el-form label-width="100px" style="padding-right: 50px" :model="form2" :rules="rules2" ref="formRef">
        <el-form-item prop="iamId" label="装维">
          <el-select v-model="form2.iamId" style="width: 300px" filterable>
            <el-option v-for="(item,index) in iams" :key="index" :label="item.name" :value="item.id">
            </el-option>
          </el-select>
        </el-form-item>
      </el-form>
      <div slot="footer" class="dialog-footer">
        <el-button @click="fromVisible2 = false">取 消</el-button>
        <el-button type="primary" @click="subOrderSave">确 定</el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script>
export default {
  name: "Orders",
  data() {
    return {
      user: JSON.parse(sessionStorage.getItem('sys-user') || '{}'),

      tableData: [],
      pageNum: 1,
      pageSize: 10,
      total: 0,

      orderSn: null,

      equipments: [],
      users: [],
      iams: [],

      fromVisible: false,
      form: {},

      ids: [],

      rules: {
      },

      fromVisible2: false,
      form2: {},
      rules2: {
        repairTime: [{required: true, message: '必填', trigger: 'blur'},],
        iamId: [{required: true, message: '必填', trigger: 'blur'},],
      },
    }
  },
  created() {
    this.load(1)
  },
  methods: {
    load(pageNum) {
      if (pageNum) this.pageNum = pageNum
      this.$request.get('/orders/selectPage', {
        params: {
          pageNum: this.pageNum,
          pageSize: this.pageSize,
          orderSn: this.orderSn,
        }
      }).then(res => {
        this.tableData = res.data?.list
        this.total = res.data?.total
      })

      this.$request.get('/equipment/selectAll').then(res => {
        this.equipments = res.data
      })
      this.$request.get('/user/selectAll').then(res => {
        this.users = res.data
      })
      this.$request.get('/iam/selectAll').then(res => {
        this.iams = res.data
      })

    },
    reset() {
      this.orderSn = null
      this.load(1)
    },
    handleAdd() {
      this.form = {
        state: 1
      }
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
            url: this.form.id ? '/orders/update' : '/orders/add',
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
        this.$request.delete('/orders/delete/' + id).then(res => {
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
        this.$request.delete('/orders/delete/batch', {data: this.ids}).then(res => {
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
    sendCenter(row) {
      this.$request({
        url: '/orders/sendCenter/' + row.id,
        method: 'GET',
      }).then(res => {
        if (res.code === '200') {
          this.$message.success('发送成功')
          this.load(1)
          this.fromVisible = false
        } else {
          this.$message.error(res.msg)
        }
      })
    },
    selectIam(row){
      this.form2 = JSON.parse(JSON.stringify(row))
      this.form2.state = 3
      this.fromVisible2 = true
    },
    subOrderSave() {
      this.$refs.formRef.validate((valid) => {
        if (valid) {
          this.$request({
            url:  '/subOrders/update',
            method: 'PUT',
            data: this.form2
          }).then(res => {
            if (res.code === '200') {
              this.$message.success('操作成功')
              this.load(1)
              this.fromVisible2 = false
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

</style>
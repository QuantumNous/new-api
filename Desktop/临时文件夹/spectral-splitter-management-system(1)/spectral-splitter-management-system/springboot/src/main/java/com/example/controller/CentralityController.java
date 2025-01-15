package com.example.controller;

import cn.hutool.poi.excel.ExcelWriter;
import com.example.common.Result;
import com.example.entity.Centrality;
import com.example.entity.SubCentrality;
import com.example.service.CentralityService;
import com.github.pagehelper.PageInfo;
import org.springframework.web.bind.annotation.*;

import javax.annotation.Resource;
import javax.servlet.http.HttpServletResponse;
import java.net.URLEncoder;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 资源中心接口
 **/
@RestController
@RequestMapping("/centrality")
public class CentralityController {

    @Resource
    private CentralityService centralityService;

    /**
     * 新增
     */
    @PostMapping("/add")
    public Result add(@RequestBody Centrality centrality) {
        centralityService.add(centrality);
        return Result.success();
    }

    /**
     * 删除
     */
    @DeleteMapping("/delete/{id}")
    public Result deleteById(@PathVariable Integer id) {
        centralityService.deleteById(id);
        return Result.success();
    }

    /**
     * 批量删除
     */
    @DeleteMapping("/delete/batch")
    public Result deleteBatch(@RequestBody List<Integer> ids) {
        centralityService.deleteBatch(ids);
        return Result.success();
    }

    /**
     * 修改
     */
    @PutMapping("/update")
    public Result updateById(@RequestBody Centrality centrality) {
        centralityService.updateById(centrality);
        return Result.success();
    }

    /**
     * 根据ID查询
     */
    @GetMapping("/selectById/{id}")
    public Result selectById(@PathVariable Integer id) {
        Centrality centrality = centralityService.selectById(id);
        return Result.success(centrality);
    }

    /**
     * 查询所有
     */
    @GetMapping("/selectAll")
    public Result selectAll(Centrality centrality) {
        List<Centrality> list = centralityService.selectAll(centrality);
        return Result.success(list);
    }

    /**
     * 分页查询
     */
    @GetMapping("/selectPage")
    public Result selectPage(Centrality centrality,
                             @RequestParam(defaultValue = "1") Integer pageNum,
                             @RequestParam(defaultValue = "10") Integer pageSize) {
        PageInfo<Centrality> page = centralityService.selectPage(centrality, pageNum, pageSize);
        return Result.success(page);
    }

    @GetMapping("/dailyCounts")
    public List<Map<String, Object>> getDailyCounts() {
        return centralityService.getDailyCounts();
    }

    @GetMapping("/export")
    public void export(HttpServletResponse response) {
        try {
            // 查询数据
            List<Centrality> list = centralityService.selectAll(new Centrality());

            // 创建 ExcelWriter
            ExcelWriter writer = cn.hutool.poi.excel.ExcelUtil.getWriter(true);

            // 设置表头
            writer.addHeaderAlias("工单号", "工单号");
            writer.addHeaderAlias("OLT编码", "OLT编码");
            writer.addHeaderAlias("开始时间", "开始时间");
            writer.addHeaderAlias("备注", "备注");
            writer.addHeaderAlias("客户名称", "客户名称");
            writer.addHeaderAlias("客户经理", "客户经理");
            writer.addHeaderAlias("割接时间", "割接时间");
            writer.addHeaderAlias("装维", "装维");
            writer.addHeaderAlias("装维反馈", "装维反馈");

            // 准备数据
            List<Map<String, Object>> rows = new ArrayList<>();
            for (Centrality centrality : list) {
                // 基本工单信息
                for (SubCentrality sub : centrality.getSubCentralityList()) {
                    Map<String, Object> row = new HashMap<>();
                    row.put("工单号", centrality.getOrderSn());
                    row.put("OLT编码", centrality.getEquipment().getOltCode());
                    row.put("开始时间", centrality.getStartTime());
                    row.put("备注", centrality.getContent());
                    row.put("客户名称", sub.getCustomer().getName());
                    row.put("客户经理", sub.getUser().getName());
                    row.put("割接时间", sub.getRepairTime());
                    row.put("装维", sub.getIam().getName());
                    row.put("装维反馈", sub.getIamContent());
                    rows.add(row);
                }

                // 如果没有客户详细信息，也输出工单的基本信息
                if (centrality.getSubCentralityList().isEmpty()) {
                    Map<String, Object> row = new HashMap<>();
                    row.put("工单号", centrality.getOrderSn());
                    row.put("OLT编码", centrality.getEquipment().getOltCode());
                    row.put("客户数量", 0);
                    row.put("开始时间", centrality.getStartTime());
                    row.put("备注", centrality.getContent());
                    row.put("客户名称", "无");
                    row.put("客户经理", "无");
                    row.put("割接时间", "无");
                    row.put("装维", "无");
                    row.put("装维反馈", "无");
                    rows.add(row);
                }
            }

            // 写入数据
            writer.write(rows, true);

            // 设置下载响应头
            response.setContentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=utf-8");
            response.setHeader("Content-Disposition", "attachment;filename=" + URLEncoder.encode("导出数据.xlsx", "UTF-8"));

            // 写出到浏览器
            writer.flush(response.getOutputStream(), true);

            // 关闭流
            writer.close();
        } catch (Exception e) {
            throw new RuntimeException("导出失败", e);
        }
    }

}

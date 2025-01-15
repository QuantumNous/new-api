package com.example.controller;

import com.example.common.Result;
import com.example.entity.SubOrders;
import com.example.service.SubOrdersService;
import com.github.pagehelper.PageInfo;
import org.springframework.web.bind.annotation.*;
import javax.annotation.Resource;
import java.util.List;

/**
 * 子订单接口
 **/
@RestController
@RequestMapping("/subOrders")
public class SubOrdersController {

    @Resource
    private SubOrdersService subOrdersService;

    /**
     * 新增
     */
    @PostMapping("/add")
    public Result add(@RequestBody SubOrders subOrders) {
        subOrdersService.add(subOrders);
        return Result.success();
    }

    /**
     * 删除
     */
    @DeleteMapping("/delete/{id}")
    public Result deleteById(@PathVariable Integer id) {
        subOrdersService.deleteById(id);
        return Result.success();
    }

    /**
     * 批量删除
     */
    @DeleteMapping("/delete/batch")
    public Result deleteBatch(@RequestBody List<Integer> ids) {
        subOrdersService.deleteBatch(ids);
        return Result.success();
    }

    /**
     * 修改
     */
    @PutMapping("/update")
    public Result updateById(@RequestBody SubOrders subOrders) {
        subOrdersService.updateById(subOrders);
        return Result.success();
    }

    /**
     * 根据ID查询
     */
    @GetMapping("/selectById/{id}")
    public Result selectById(@PathVariable Integer id) {
        SubOrders subOrders = subOrdersService.selectById(id);
        return Result.success(subOrders);
    }

    /**
     * 查询所有
     */
    @GetMapping("/selectAll")
    public Result selectAll(SubOrders subOrders) {
        List<SubOrders> list = subOrdersService.selectAll(subOrders);
        return Result.success(list);
    }

    /**
     * 分页查询
     */
    @GetMapping("/selectPage")
    public Result selectPage(SubOrders subOrders,
                             @RequestParam(defaultValue = "1") Integer pageNum,
                             @RequestParam(defaultValue = "10") Integer pageSize) {
        PageInfo<SubOrders> page = subOrdersService.selectPage(subOrders, pageNum, pageSize);
        return Result.success(page);
    }

}

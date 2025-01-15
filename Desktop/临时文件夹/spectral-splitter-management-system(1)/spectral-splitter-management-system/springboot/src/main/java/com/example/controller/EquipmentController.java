package com.example.controller;

import com.example.common.Result;
import com.example.entity.Equipment;
import com.example.service.EquipmentService;
import com.github.pagehelper.PageInfo;
import org.springframework.web.bind.annotation.*;
import javax.annotation.Resource;
import java.util.List;

/**
 * 分光器接口
 **/
@RestController
@RequestMapping("/equipment")
public class EquipmentController {

    @Resource
    private EquipmentService equipmentService;

    /**
     * 新增
     */
    @PostMapping("/add")
    public Result add(@RequestBody Equipment equipment) {
        equipmentService.add(equipment);
        return Result.success();
    }

    /**
     * 删除
     */
    @DeleteMapping("/delete/{id}")
    public Result deleteById(@PathVariable Integer id) {
        equipmentService.deleteById(id);
        return Result.success();
    }

    /**
     * 批量删除
     */
    @DeleteMapping("/delete/batch")
    public Result deleteBatch(@RequestBody List<Integer> ids) {
        equipmentService.deleteBatch(ids);
        return Result.success();
    }

    /**
     * 修改
     */
    @PutMapping("/update")
    public Result updateById(@RequestBody Equipment equipment) {
        equipmentService.updateById(equipment);
        return Result.success();
    }

    /**
     * 根据ID查询
     */
    @GetMapping("/selectById/{id}")
    public Result selectById(@PathVariable Integer id) {
        Equipment equipment = equipmentService.selectById(id);
        return Result.success(equipment);
    }

    /**
     * 查询所有
     */
    @GetMapping("/selectAll")
    public Result selectAll(Equipment equipment) {
        List<Equipment> list = equipmentService.selectAll(equipment);
        return Result.success(list);
    }

    /**
     * 分页查询
     */
    @GetMapping("/selectPage")
    public Result selectPage(Equipment equipment,
                             @RequestParam(defaultValue = "1") Integer pageNum,
                             @RequestParam(defaultValue = "10") Integer pageSize) {
        PageInfo<Equipment> page = equipmentService.selectPage(equipment, pageNum, pageSize);
        return Result.success(page);
    }


    /**
     * 新增
     */
    @PostMapping("/createOrder")
    public Result createOrder(@RequestBody Equipment equipment) {
        equipmentService.createOrder(equipment);
        return Result.success();
    }
}

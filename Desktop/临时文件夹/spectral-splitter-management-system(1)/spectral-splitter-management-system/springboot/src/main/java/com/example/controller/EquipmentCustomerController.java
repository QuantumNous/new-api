package com.example.controller;

import com.example.common.Result;
import com.example.entity.EquipmentCustomer;
import com.example.service.EquipmentCustomerService;
import com.github.pagehelper.PageInfo;
import org.springframework.web.bind.annotation.*;
import javax.annotation.Resource;
import java.util.List;

/**
 * 设备-客户接口
 **/
@RestController
@RequestMapping("/equipmentCustomer")
public class EquipmentCustomerController {

    @Resource
    private EquipmentCustomerService equipmentCustomerService;

    /**
     * 新增
     */
    @PostMapping("/add")
    public Result add(@RequestBody EquipmentCustomer equipmentCustomer) {
        equipmentCustomerService.add(equipmentCustomer);
        return Result.success();
    }

    /**
     * 删除
     */
    @DeleteMapping("/delete/{id}")
    public Result deleteById(@PathVariable Integer id) {
        equipmentCustomerService.deleteById(id);
        return Result.success();
    }

    /**
     * 批量删除
     */
    @DeleteMapping("/delete/batch")
    public Result deleteBatch(@RequestBody List<Integer> ids) {
        equipmentCustomerService.deleteBatch(ids);
        return Result.success();
    }

    /**
     * 修改
     */
    @PutMapping("/update")
    public Result updateById(@RequestBody EquipmentCustomer equipmentCustomer) {
        equipmentCustomerService.updateById(equipmentCustomer);
        return Result.success();
    }

    /**
     * 根据ID查询
     */
    @GetMapping("/selectById/{id}")
    public Result selectById(@PathVariable Integer id) {
        EquipmentCustomer equipmentCustomer = equipmentCustomerService.selectById(id);
        return Result.success(equipmentCustomer);
    }

    /**
     * 查询所有
     */
    @GetMapping("/selectAll")
    public Result selectAll(EquipmentCustomer equipmentCustomer) {
        List<EquipmentCustomer> list = equipmentCustomerService.selectAll(equipmentCustomer);
        return Result.success(list);
    }

    /**
     * 分页查询
     */
    @GetMapping("/selectPage")
    public Result selectPage(EquipmentCustomer equipmentCustomer,
                             @RequestParam(defaultValue = "1") Integer pageNum,
                             @RequestParam(defaultValue = "10") Integer pageSize) {
        PageInfo<EquipmentCustomer> page = equipmentCustomerService.selectPage(equipmentCustomer, pageNum, pageSize);
        return Result.success(page);
    }

}

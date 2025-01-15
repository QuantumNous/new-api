package com.example.controller;

import com.example.common.Result;
import com.example.entity.SubCentrality;
import com.example.service.SubCentralityService;
import com.github.pagehelper.PageInfo;
import org.springframework.web.bind.annotation.*;
import javax.annotation.Resource;
import java.util.List;

/**
 * 子资源接口
 **/
@RestController
@RequestMapping("/subCentrality")
public class SubCentralityController {

    @Resource
    private SubCentralityService subCentralityService;

    /**
     * 新增
     */
    @PostMapping("/add")
    public Result add(@RequestBody SubCentrality subCentrality) {
        subCentralityService.add(subCentrality);
        return Result.success();
    }

    /**
     * 删除
     */
    @DeleteMapping("/delete/{id}")
    public Result deleteById(@PathVariable Integer id) {
        subCentralityService.deleteById(id);
        return Result.success();
    }

    /**
     * 批量删除
     */
    @DeleteMapping("/delete/batch")
    public Result deleteBatch(@RequestBody List<Integer> ids) {
        subCentralityService.deleteBatch(ids);
        return Result.success();
    }

    /**
     * 修改
     */
    @PutMapping("/update")
    public Result updateById(@RequestBody SubCentrality subCentrality) {
        subCentralityService.updateById(subCentrality);
        return Result.success();
    }

    /**
     * 根据ID查询
     */
    @GetMapping("/selectById/{id}")
    public Result selectById(@PathVariable Integer id) {
        SubCentrality subCentrality = subCentralityService.selectById(id);
        return Result.success(subCentrality);
    }

    /**
     * 查询所有
     */
    @GetMapping("/selectAll")
    public Result selectAll(SubCentrality subCentrality) {
        List<SubCentrality> list = subCentralityService.selectAll(subCentrality);
        return Result.success(list);
    }

    /**
     * 分页查询
     */
    @GetMapping("/selectPage")
    public Result selectPage(SubCentrality subCentrality,
                             @RequestParam(defaultValue = "1") Integer pageNum,
                             @RequestParam(defaultValue = "10") Integer pageSize) {
        PageInfo<SubCentrality> page = subCentralityService.selectPage(subCentrality, pageNum, pageSize);
        return Result.success(page);
    }

}

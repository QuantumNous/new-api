package com.example.controller;

import com.example.common.Result;
import com.example.entity.Iam;
import com.example.entity.User;
import com.example.service.IamService;
import com.example.service.UserService;
import com.github.pagehelper.PageInfo;
import org.springframework.web.bind.annotation.*;

import javax.annotation.Resource;
import java.util.List;

/**
 * 装维前端操作接口
 **/
@RestController
@RequestMapping("/iam")
public class IamController {

    @Resource
    private IamService iamService;

    /**
     * 新增
     */
    @PostMapping("/add")
    public Result add(@RequestBody Iam iam) {
        iamService.add(iam);
        return Result.success();
    }

    /**
     * 删除
     */
    @DeleteMapping("/delete/{id}")
    public Result deleteById(@PathVariable Integer id) {
        iamService.deleteById(id);
        return Result.success();
    }

    /**
     * 批量删除
     */
    @DeleteMapping("/delete/batch")
    public Result deleteBatch(@RequestBody List<Integer> ids) {
        iamService.deleteBatch(ids);
        return Result.success();
    }

    /**
     * 修改
     */
    @PutMapping("/update")
    public Result updateById(@RequestBody Iam iam) {
        iamService.updateById(iam);
        return Result.success();
    }

    /**
     * 根据ID查询
     */
    @GetMapping("/selectById/{id}")
    public Result selectById(@PathVariable Integer id) {
        Iam iam = iamService.selectById(id);
        return Result.success(iam);
    }

    /**
     * 查询所有
     */
    @GetMapping("/selectAll")
    public Result selectAll(Iam iam) {
        List<Iam> list = iamService.selectAll(iam);
        return Result.success(list);
    }

    /**
     * 分页查询
     */
    @GetMapping("/selectPage")
    public Result selectPage(Iam iam,
                             @RequestParam(defaultValue = "1") Integer pageNum,
                             @RequestParam(defaultValue = "10") Integer pageSize) {
        PageInfo<Iam> page = iamService.selectPage(iam, pageNum, pageSize);
        return Result.success(page);
    }

}
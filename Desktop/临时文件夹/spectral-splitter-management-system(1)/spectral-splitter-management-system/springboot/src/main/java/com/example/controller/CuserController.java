package com.example.controller;

import com.example.common.Result;
import com.example.entity.Cuser;
import com.example.service.CuserService;
import com.github.pagehelper.PageInfo;
import org.springframework.web.bind.annotation.*;
import javax.annotation.Resource;
import java.util.List;

/**
 * 资源用户接口
 **/
@RestController
@RequestMapping("/cuser")
public class CuserController {

    @Resource
    private CuserService cuserService;

    /**
     * 新增
     */
    @PostMapping("/add")
    public Result add(@RequestBody Cuser cuser) {
        cuserService.add(cuser);
        return Result.success();
    }

    /**
     * 删除
     */
    @DeleteMapping("/delete/{id}")
    public Result deleteById(@PathVariable Integer id) {
        cuserService.deleteById(id);
        return Result.success();
    }

    /**
     * 批量删除
     */
    @DeleteMapping("/delete/batch")
    public Result deleteBatch(@RequestBody List<Integer> ids) {
        cuserService.deleteBatch(ids);
        return Result.success();
    }

    /**
     * 修改
     */
    @PutMapping("/update")
    public Result updateById(@RequestBody Cuser cuser) {
        cuserService.updateById(cuser);
        return Result.success();
    }

    /**
     * 根据ID查询
     */
    @GetMapping("/selectById/{id}")
    public Result selectById(@PathVariable Integer id) {
        Cuser cuser = cuserService.selectById(id);
        return Result.success(cuser);
    }

    /**
     * 查询所有
     */
    @GetMapping("/selectAll")
    public Result selectAll(Cuser cuser) {
        List<Cuser> list = cuserService.selectAll(cuser);
        return Result.success(list);
    }

    /**
     * 分页查询
     */
    @GetMapping("/selectPage")
    public Result selectPage(Cuser cuser,
                             @RequestParam(defaultValue = "1") Integer pageNum,
                             @RequestParam(defaultValue = "10") Integer pageSize) {
        PageInfo<Cuser> page = cuserService.selectPage(cuser, pageNum, pageSize);
        return Result.success(page);
    }

}

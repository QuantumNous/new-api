package com.example.service;

import com.example.entity.SubCentrality;
import com.example.mapper.SubCentralityMapper;
import com.github.pagehelper.PageHelper;
import com.github.pagehelper.PageInfo;
import org.springframework.stereotype.Service;
import javax.annotation.Resource;
import java.util.List;

/**
 * 子资源业务处理
 **/
@Service
public class SubCentralityService {

    @Resource
    private SubCentralityMapper subCentralityMapper;

    /**
     * 新增
     */
    public void add(SubCentrality subCentrality) {
        subCentralityMapper.insert(subCentrality);
    }

    /**
     * 删除
     */
    public void deleteById(Integer id) {
        subCentralityMapper.deleteById(id);
    }

    /**
     * 批量删除
     */
    public void deleteBatch(List<Integer> ids) {
        for (Integer id : ids) {
            subCentralityMapper.deleteById(id);
        }
    }

    /**
     * 修改
     */
    public void updateById(SubCentrality subCentrality) {
        subCentralityMapper.updateById(subCentrality);
    }

    /**
     * 根据ID查询
     */
    public SubCentrality selectById(Integer id) {
        return subCentralityMapper.selectById(id);
    }

    /**
     * 查询所有
     */
    public List<SubCentrality> selectAll(SubCentrality subCentrality) {
        return subCentralityMapper.selectAll(subCentrality);
    }

    /**
     * 分页查询
     */
    public PageInfo<SubCentrality> selectPage(SubCentrality subCentrality, Integer pageNum, Integer pageSize) {
        PageHelper.startPage(pageNum, pageSize);
        List<SubCentrality> list = selectAll(subCentrality);
        return PageInfo.of(list);
    }

}



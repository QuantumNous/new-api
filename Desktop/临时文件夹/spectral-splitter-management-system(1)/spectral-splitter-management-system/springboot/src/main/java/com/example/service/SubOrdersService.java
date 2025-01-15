package com.example.service;

import com.example.entity.SubOrders;
import com.example.mapper.SubOrdersMapper;
import com.github.pagehelper.PageHelper;
import com.github.pagehelper.PageInfo;
import org.springframework.stereotype.Service;
import javax.annotation.Resource;
import java.util.List;

/**
 * 子订单业务处理
 **/
@Service
public class SubOrdersService {

    @Resource
    private SubOrdersMapper subOrdersMapper;

    /**
     * 新增
     */
    public void add(SubOrders subOrders) {
        subOrdersMapper.insert(subOrders);
    }

    /**
     * 删除
     */
    public void deleteById(Integer id) {
        subOrdersMapper.deleteById(id);
    }

    /**
     * 批量删除
     */
    public void deleteBatch(List<Integer> ids) {
        for (Integer id : ids) {
            subOrdersMapper.deleteById(id);
        }
    }

    /**
     * 修改
     */
    public void updateById(SubOrders subOrders) {
        subOrdersMapper.updateById(subOrders);
    }

    /**
     * 根据ID查询
     */
    public SubOrders selectById(Integer id) {
        return subOrdersMapper.selectById(id);
    }

    /**
     * 查询所有
     */
    public List<SubOrders> selectAll(SubOrders subOrders) {
        return subOrdersMapper.selectAll(subOrders);
    }

    /**
     * 分页查询
     */
    public PageInfo<SubOrders> selectPage(SubOrders subOrders, Integer pageNum, Integer pageSize) {
        PageHelper.startPage(pageNum, pageSize);
        List<SubOrders> list = selectAll(subOrders);
        return PageInfo.of(list);
    }

}



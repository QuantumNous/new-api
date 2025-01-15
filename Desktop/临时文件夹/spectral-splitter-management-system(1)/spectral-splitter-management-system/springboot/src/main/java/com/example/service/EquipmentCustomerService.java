package com.example.service;

import com.example.entity.EquipmentCustomer;
import com.example.exception.CustomException;
import com.example.mapper.EquipmentCustomerMapper;
import com.github.pagehelper.PageHelper;
import com.github.pagehelper.PageInfo;
import org.springframework.stereotype.Service;
import javax.annotation.Resource;
import java.util.List;

/**
 * 设备-客户业务处理
 **/
@Service
public class EquipmentCustomerService {

    @Resource
    private EquipmentCustomerMapper equipmentCustomerMapper;

    /**
     * 新增
     */
    public void add(EquipmentCustomer equipmentCustomer) {
        List<EquipmentCustomer> equipmentCustomerList = equipmentCustomerMapper.selectAll(equipmentCustomer);
        if (equipmentCustomerList.size() > 0)
            throw new CustomException("600","客户已存在");
        equipmentCustomerMapper.insert(equipmentCustomer);
    }

    /**
     * 删除
     */
    public void deleteById(Integer id) {
        equipmentCustomerMapper.deleteById(id);
    }

    /**
     * 批量删除
     */
    public void deleteBatch(List<Integer> ids) {
        for (Integer id : ids) {
            equipmentCustomerMapper.deleteById(id);
        }
    }

    /**
     * 修改
     */
    public void updateById(EquipmentCustomer equipmentCustomer) {
        equipmentCustomerMapper.updateById(equipmentCustomer);
    }

    /**
     * 根据ID查询
     */
    public EquipmentCustomer selectById(Integer id) {
        return equipmentCustomerMapper.selectById(id);
    }

    /**
     * 查询所有
     */
    public List<EquipmentCustomer> selectAll(EquipmentCustomer equipmentCustomer) {
        return equipmentCustomerMapper.selectAll(equipmentCustomer);
    }

    /**
     * 分页查询
     */
    public PageInfo<EquipmentCustomer> selectPage(EquipmentCustomer equipmentCustomer, Integer pageNum, Integer pageSize) {
        PageHelper.startPage(pageNum, pageSize);
        List<EquipmentCustomer> list = selectAll(equipmentCustomer);
        return PageInfo.of(list);
    }

}



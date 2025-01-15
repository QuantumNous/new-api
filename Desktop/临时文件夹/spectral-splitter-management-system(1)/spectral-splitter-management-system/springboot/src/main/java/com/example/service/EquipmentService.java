package com.example.service;

import cn.hutool.core.util.IdUtil;
import com.example.entity.Equipment;
import com.example.entity.EquipmentCustomer;
import com.example.entity.Orders;
import com.example.entity.SubOrders;
import com.example.mapper.*;
import com.github.pagehelper.PageHelper;
import com.github.pagehelper.PageInfo;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.annotation.Resource;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 分光器业务处理
 **/
@Service
public class EquipmentService {

    @Resource
    private EquipmentMapper equipmentMapper;
    @Resource
    private EquipmentCustomerMapper equipmentCustomerMapper;
    @Resource
    private CustomerMapper customerMapper;
    @Resource
    private OrdersMapper ordersMapper;
    @Resource
    private SubOrdersMapper subOrdersMapper;
    /**
     * 新增
     */
    public void add(Equipment equipment) {
        equipmentMapper.insert(equipment);
    }

    /**
     * 删除
     */
    public void deleteById(Integer id) {
        equipmentMapper.deleteById(id);
    }

    /**
     * 批量删除
     */
    public void deleteBatch(List<Integer> ids) {
        for (Integer id : ids) {
            equipmentMapper.deleteById(id);
        }
    }

    /**
     * 修改
     */
    public void updateById(Equipment equipment) {
        equipmentMapper.updateById(equipment);
    }

    /**
     * 根据ID查询
     */
    public Equipment selectById(Integer id) {
        return equipmentMapper.selectById(id);
    }

    /**
     * 查询所有
     */
    public List<Equipment> selectAll(Equipment equipment) {
        List<Equipment> list = equipmentMapper.selectAll(equipment);
        for (Equipment dbEquipment : list) {
            List<EquipmentCustomer> equipmentCustomerList = equipmentCustomerMapper.selectListByEquipmentId(dbEquipment.getId());
            for (EquipmentCustomer equipmentCustomer : equipmentCustomerList) {
                equipmentCustomer.setCustomer(customerMapper.selectById(equipmentCustomer.getCustomerId()));
            }
            dbEquipment.setEquipmentCustomerList(equipmentCustomerList);
        }
        return list;
    }

    /**
     * 分页查询
     */
    public PageInfo<Equipment> selectPage(Equipment equipment, Integer pageNum, Integer pageSize) {
        PageHelper.startPage(pageNum, pageSize);
        List<Equipment> list = selectAll(equipment);
        return PageInfo.of(list);
    }

    @Transactional
    public void createOrder(Equipment equipment) {
        Orders orders = new Orders();
        orders.setOrderSn(IdUtil.getSnowflakeNextIdStr());
        orders.setEquipmentId(equipment.getId());
        orders.setStartTime(LocalDateTime.now());
        orders.setState(1);

        ordersMapper.insert(orders);

        List<EquipmentCustomer> equipmentCustomerList = equipment.getEquipmentCustomerList();
        for (EquipmentCustomer equipmentCustomer : equipmentCustomerList) {
            SubOrders subOrders = new SubOrders();
            subOrders.setOrderId(orders.getId());
            subOrders.setUserId(equipmentCustomer.getUserId());
            subOrders.setCustomerId(equipmentCustomer.getCustomerId());
            subOrders.setState(1);
            subOrdersMapper.insert(subOrders);
        }
    }
}



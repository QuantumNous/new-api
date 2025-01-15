package com.example.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.example.entity.EquipmentCustomer;
import org.apache.ibatis.annotations.Select;

import java.util.List;

/**
 *  设备-客户
 */
public interface EquipmentCustomerMapper extends BaseMapper<EquipmentCustomer> {

    List<EquipmentCustomer> selectAll(EquipmentCustomer EquipmentCustomer);

    @Select("select * from equipment_customer where equipment_id = #{equipmentId}")
    List<EquipmentCustomer> selectListByEquipmentId(Integer equipmentId);

}

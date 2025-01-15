package com.example.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.example.entity.Equipment;
import java.util.List;

/**
 *  分光器
 */
public interface EquipmentMapper extends BaseMapper<Equipment> {

    List<Equipment> selectAll(Equipment Equipment);

}

package com.example.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.io.Serializable;
import java.util.List;

/**
 *  分光器
 */
@Data
@TableName("equipment")
public class Equipment implements Serializable  {

    private static final long serialVersionUID = 1L;

    /** id */
    @TableId(value = "id", type = IdType.AUTO)
    private Integer id;

    /** 区域 */
    private String area;
    
    /** 业务类型 */
    private String classify;
    
    /** OLT编码 */
    private String oltCode;
    
    /** OLT名称 */
    private String oltName;

    @TableField(exist = false)
    private List<EquipmentCustomer> equipmentCustomerList;
    
}


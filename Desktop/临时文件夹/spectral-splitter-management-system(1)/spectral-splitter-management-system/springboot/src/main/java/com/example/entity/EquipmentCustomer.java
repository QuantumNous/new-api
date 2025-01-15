package com.example.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.io.Serializable;

/**
 *  设备-客户
 */
@Data
@TableName("equipment_customer")
public class EquipmentCustomer implements Serializable  {

    private static final long serialVersionUID = 1L;

    @TableId(value = "id", type = IdType.AUTO)
    private Integer id;

    /** 设备id */
    private Integer equipmentId;
    
    /** 客户id */
    private Integer customerId;

    @TableField(exist = false)
    private Customer customer;

    @TableField(exist = false)
    private Integer userId;

}


package com.example.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.Data;

import java.io.Serializable;
import java.util.Date;

/**
 *  子订单
 */
@Data
@TableName("sub_orders")
public class SubOrders implements Serializable  {

    private static final long serialVersionUID = 1L;

    /** id */
    @TableId(value = "id", type = IdType.AUTO)
    private Integer id;

    /** 订单id */
    private Integer orderId;
    
    /** 客户 */
    private Integer customerId;
    
    /** 客户经理 */
    private Integer userId;
    
    /** 装维 */
    private Integer iamId;
    
    /** 割接时间 */
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss", timezone = "GMT+8")
    private Date repairTime;
    
    /** 装维反馈 */
    private String iamContent;

    private Integer state;

    @TableField(exist = false)
    private Customer customer;

    @TableField(exist = false)
    private User user;

    @TableField(exist = false)
    private Iam iam;
}


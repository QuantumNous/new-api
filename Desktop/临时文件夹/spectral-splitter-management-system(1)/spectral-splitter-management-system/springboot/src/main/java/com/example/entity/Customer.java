package com.example.entity;


import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.io.Serializable;

/**
 *  客户
 */
@Data
@TableName("customer")
public class Customer implements Serializable  {

    private static final long serialVersionUID = 1L;

    /** id */
    @TableId(value = "id", type = IdType.AUTO)
    private Integer id;

    /** 姓名 */
    private String name;
    
    /** 地址 */
    private String address;
    
    /** 手机号 */
    private String phone;
}


package com.example.entity;


import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.io.Serializable;

/**
 *  资源用户
 */
@Data
@TableName("cuser")
public class Cuser extends Account implements Serializable {

    private static final long serialVersionUID = 1L;

    /** ID */
    @TableId(value = "id", type = IdType.AUTO)
    private Integer id;

    /** 用户名 */
    private String username;
    
    /** 密码 */
    private String password;
    
    /** 姓名 */
    private String name;
    
    /** 头像 */
    private String avatar;
    
    /** 角色标识 */
    private String role;
    
    /** 电话 */
    private String phone;
    
    /** 邮箱 */
    private String email;
    
}


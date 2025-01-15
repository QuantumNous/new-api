package com.example.entity;

import com.baomidou.mybatisplus.annotation.TableField;
import lombok.Data;

@Data
public class Account {

    private Integer id;

    private String username;

    private String name;

    private String password;

    private String avatar;

    private String role;

    @TableField(exist = false)
    private String token;

    @TableField(exist = false)
    private String newPassword;

    @TableField(exist = false)
    private String captchaCode;

}

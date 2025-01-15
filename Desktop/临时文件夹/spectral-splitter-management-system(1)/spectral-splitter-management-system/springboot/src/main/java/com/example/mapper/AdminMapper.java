package com.example.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.example.entity.Admin;
import org.apache.ibatis.annotations.Select;

import java.util.List;

public interface AdminMapper extends BaseMapper<Admin> {

    List<Admin> selectAll(Admin admin);

    @Select("select * from admin where username = #{username}")
    Admin selectByUsername(String username);
}
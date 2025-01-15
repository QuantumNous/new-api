package com.example.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.example.entity.Admin;
import com.example.entity.User;
import org.apache.ibatis.annotations.Select;

import java.util.List;

public interface UserMapper extends BaseMapper<User> {

    List<User> selectAll(User user);

    @Select("select * from user where username = #{username}")
    User selectByUsername(String username);
}
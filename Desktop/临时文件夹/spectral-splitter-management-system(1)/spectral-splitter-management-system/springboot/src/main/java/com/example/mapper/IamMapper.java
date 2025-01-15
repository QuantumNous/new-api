package com.example.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.example.entity.Iam;
import org.apache.ibatis.annotations.Select;

import java.util.List;

public interface IamMapper extends BaseMapper<Iam> {

    List<Iam> selectAll(Iam iam);

    @Select("select * from iam where username = #{username}")
    Iam selectByUsername(String username);
}
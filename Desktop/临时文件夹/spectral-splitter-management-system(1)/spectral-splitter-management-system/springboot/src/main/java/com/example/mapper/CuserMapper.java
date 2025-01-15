package com.example.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.example.entity.Cuser;
import org.apache.ibatis.annotations.Select;

import java.util.List;

/**
 *  资源用户
 */
public interface CuserMapper extends BaseMapper<Cuser> {

    List<Cuser> selectAll(Cuser Cuser);

    @Select("select * from cuser where username = #{username}")
    Cuser selectByUsername(String username);
}

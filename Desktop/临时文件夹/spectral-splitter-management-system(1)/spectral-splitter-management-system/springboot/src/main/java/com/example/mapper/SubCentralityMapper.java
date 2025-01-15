package com.example.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.example.entity.SubCentrality;
import java.util.List;

/**
 *  子资源
 */
public interface SubCentralityMapper extends BaseMapper<SubCentrality> {

    List<SubCentrality> selectAll(SubCentrality SubCentrality);

}

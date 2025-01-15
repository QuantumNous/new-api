package com.example.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.example.entity.Centrality;
import org.apache.ibatis.annotations.Select;

import java.util.List;
import java.util.Map;

/**
 *  资源中心
 */
public interface CentralityMapper extends BaseMapper<Centrality> {

    List<Centrality> selectAll(Centrality Centrality);

    @Select("SELECT DATE_FORMAT(start_time, '%Y-%m-%d') AS date, COUNT(*) AS total " +
            "FROM centrality " +
            "WHERE start_time >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) " +
            "GROUP BY DATE_FORMAT(start_time, '%Y-%m-%d')")
    List<Map<String, Object>> getDailyCounts();
}

package com.example.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.example.entity.Orders;
import org.apache.ibatis.annotations.Select;

import java.util.List;
import java.util.Map;

/**
 *  工单
 */
public interface OrdersMapper extends BaseMapper<Orders> {

    List<Orders> selectAll(Orders Orders);

    @Select("SELECT DATE_FORMAT(start_time, '%Y-%m-%d') AS date, COUNT(*) AS total " +
            "FROM orders " +
            "WHERE start_time >= CURDATE() - INTERVAL 29 DAY AND (state = 1) " +
            "GROUP BY DATE_FORMAT(start_time, '%Y-%m-%d')")
    List<Map<String, Object>> getDailyState3Counts();

}

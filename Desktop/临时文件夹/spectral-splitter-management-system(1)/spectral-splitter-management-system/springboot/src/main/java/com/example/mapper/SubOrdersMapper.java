package com.example.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.example.entity.SubOrders;
import java.util.List;

/**
 *  子工单
 */
public interface SubOrdersMapper extends BaseMapper<SubOrders> {

    List<SubOrders> selectAll(SubOrders SubOrders);

}

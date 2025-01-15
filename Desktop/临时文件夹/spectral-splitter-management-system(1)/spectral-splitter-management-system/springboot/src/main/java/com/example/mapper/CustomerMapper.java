package com.example.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.example.entity.Customer;
import java.util.List;

/**
 *  客户
 */
public interface CustomerMapper extends BaseMapper<Customer> {

    List<Customer> selectAll(Customer Customer);

}

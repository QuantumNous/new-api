package com.example;

import com.example.mapper.CentralityMapper;
import com.example.mapper.OrdersMapper;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

import javax.annotation.Resource;

@SpringBootTest
class SpringbootApplicationTests {

    @Resource
    private OrdersMapper ordersMapper;

    @Test
    void contextLoads() {
        System.out.println(ordersMapper.getDailyState3Counts());
    }

}

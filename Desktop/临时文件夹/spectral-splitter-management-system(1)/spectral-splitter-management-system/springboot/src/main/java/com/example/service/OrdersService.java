package com.example.service;

import cn.hutool.core.util.IdUtil;
import com.example.entity.*;
import com.example.mapper.*;
import com.github.pagehelper.PageHelper;
import com.github.pagehelper.PageInfo;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.annotation.Resource;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 工单业务处理
 **/
@Service
public class OrdersService {

    @Resource
    private OrdersMapper ordersMapper;
    @Resource
    private UserMapper userMapper;
    @Resource
    private IamMapper iamMapper;
    @Resource
    private EquipmentMapper equipmentMapper;
    @Resource
    private CentralityMapper centralityMapper;
    @Resource
    private SubCentralityMapper subCentralityMapper;
    @Resource
    private SubOrdersMapper subOrdersMapper;
    @Resource
    private CustomerMapper customerMapper;
    /**
     * 新增
     */
    public void add(Orders orders) {
        orders.setOrderSn(IdUtil.getSnowflakeNextIdStr());
        orders.setStartTime(LocalDateTime.now());
        ordersMapper.insert(orders);
    }

    /**
     * 删除
     */
    public void deleteById(Integer id) {
        ordersMapper.deleteById(id);
    }

    /**
     * 批量删除
     */
    public void deleteBatch(List<Integer> ids) {
        for (Integer id : ids) {
            ordersMapper.deleteById(id);
        }
    }

    /**
     * 修改
     */
    public void updateById(Orders orders) {
        ordersMapper.updateById(orders);
    }

    /**
     * 根据ID查询
     */
    public Orders selectById(Integer id) {
        return ordersMapper.selectById(id);
    }

    /**
     * 查询所有
     */
    public List<Orders> selectAll(Orders orders) {
        List<Orders> list = ordersMapper.selectAll(orders);
        for (Orders dbOrders : list) {
            Equipment equipment = equipmentMapper.selectById(dbOrders.getEquipmentId());
            if (equipment != null)
                dbOrders.setEquipment(equipment);

            SubOrders subOrders = new SubOrders();
            subOrders.setOrderId(dbOrders.getId());
            List<SubOrders> subOrdersList = subOrdersMapper.selectAll(subOrders);

            boolean allSubOrdersStateIs4 = true;  // 标记所有子订单状态是否都是4

            for (SubOrders dbSubOrders : subOrdersList) {
                User user = userMapper.selectById(dbSubOrders.getUserId());
                if (user != null)
                    dbSubOrders.setUser(user);

                Iam iam = iamMapper.selectById(dbSubOrders.getIamId());
                if (iam != null)
                    dbSubOrders.setIam(iam);

                Customer customer = customerMapper.selectById(dbSubOrders.getCustomerId());
                if (customer != null)
                    dbSubOrders.setCustomer(customer);

                if (dbSubOrders.getState() != 4) {
                    allSubOrdersStateIs4 = false;
                }
            }

            if (allSubOrdersStateIs4 && dbOrders.getState() < 2) {
                dbOrders.setState(2);
                ordersMapper.updateById(dbOrders);
            }

            dbOrders.setSubOrdersList(subOrdersList);
        }
        return list;
    }


    /**
     * 分页查询
     */
    public PageInfo<Orders> selectPage(Orders orders, Integer pageNum, Integer pageSize) {
        PageHelper.startPage(pageNum, pageSize);
        List<Orders> list = selectAll(orders);
        return PageInfo.of(list);
    }

    @Transactional
    public void sendCenter(Integer id) {
        Orders orders = ordersMapper.selectById(id);

        SubOrders subOrders = new SubOrders();
        subOrders.setOrderId(orders.getId());

        Centrality centrality = new Centrality();
        centrality.setOrderSn(orders.getOrderSn());
        centrality.setEquipmentId(orders.getEquipmentId());
        centrality.setStartTime(orders.getStartTime());
        centrality.setContent(orders.getContent());
        centralityMapper.insert(centrality);

        List<SubOrders> subOrdersList = subOrdersMapper.selectAll(subOrders);
        for (SubOrders dbSubOrders : subOrdersList) {
            SubCentrality subCentrality = new SubCentrality();
            subCentrality.setCentralityId(centrality.getId());
            subCentrality.setCustomerId(dbSubOrders.getCustomerId());
            subCentrality.setUserId(dbSubOrders.getUserId());
            subCentrality.setIamId(dbSubOrders.getIamId());
            subCentrality.setRepairTime(dbSubOrders.getRepairTime());
            subCentrality.setIam(dbSubOrders.getIam());
            subCentrality.setIamContent(dbSubOrders.getIamContent());
            subCentralityMapper.insert(subCentrality);
        }

        orders.setState(3);
        ordersMapper.updateById(orders);

    }

    public List<Map<String, Object>> getMonthlyState3Counts() {
        List<Map<String, Object>> rawData = ordersMapper.getDailyState3Counts();

        Map<String, Integer> dataMap = rawData.stream()
                .collect(Collectors.toMap(
                        map -> map.get("date").toString(),
                        map -> Integer.parseInt(map.get("total").toString())
                ));

        List<Map<String, Object>> fullResults = new ArrayList<>();
        LocalDate today = LocalDate.now();
        for (int i = 29; i >= 0; i--) {
            String date = today.minusDays(i).toString();
            Map<String, Object> map = new HashMap<>();
            map.put("date", date);
            map.put("total", dataMap.getOrDefault(date, 0)); // 默认值为 0
            fullResults.add(map);
        }

        return fullResults;
    }
}



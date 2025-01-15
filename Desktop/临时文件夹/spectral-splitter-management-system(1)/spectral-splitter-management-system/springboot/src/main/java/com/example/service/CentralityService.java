package com.example.service;

import com.example.entity.*;
import com.example.mapper.*;
import com.github.pagehelper.PageHelper;
import com.github.pagehelper.PageInfo;
import org.springframework.stereotype.Service;
import javax.annotation.Resource;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 资源中心业务处理
 **/
@Service
public class CentralityService {

    @Resource
    private CentralityMapper centralityMapper;
    @Resource
    private SubCentralityMapper subCentralityMapper;
    @Resource
    private UserMapper userMapper;
    @Resource
    private IamMapper iamMapper;
    @Resource
    private EquipmentMapper equipmentMapper;
    @Resource
    private CustomerMapper customerMapper;
    /**
     * 新增
     */
    public void add(Centrality centrality) {
        centralityMapper.insert(centrality);
    }

    /**
     * 删除
     */
    public void deleteById(Integer id) {
        centralityMapper.deleteById(id);
    }

    /**
     * 批量删除
     */
    public void deleteBatch(List<Integer> ids) {
        for (Integer id : ids) {
            centralityMapper.deleteById(id);
        }
    }

    /**
     * 修改
     */
    public void updateById(Centrality centrality) {
        centralityMapper.updateById(centrality);
    }

    /**
     * 根据ID查询
     */
    public Centrality selectById(Integer id) {
        return centralityMapper.selectById(id);
    }

    /**
     * 查询所有
     */
    public List<Centrality> selectAll(Centrality centrality) {
        List<Centrality> list = centralityMapper.selectAll(centrality);
        for (Centrality dbCentrality : list) {
            Equipment equipment = equipmentMapper.selectById(dbCentrality.getEquipmentId());
            if (equipment != null)
                dbCentrality.setEquipment(equipment);

            SubCentrality subCentrality = new SubCentrality();
            subCentrality.setCentralityId(dbCentrality.getId());
            List<SubCentrality> subCentralityList = subCentralityMapper.selectAll(subCentrality);

            for (SubCentrality dbSubCentrality : subCentralityList) {
                User user = userMapper.selectById(dbSubCentrality.getUserId());
                if (user != null)
                    dbSubCentrality.setUser(user);

                Iam iam = iamMapper.selectById(dbSubCentrality.getIamId());
                if (iam != null)
                    dbSubCentrality.setIam(iam);

                Customer customer = customerMapper.selectById(dbSubCentrality.getCustomerId());
                if (customer != null)
                    dbSubCentrality.setCustomer(customer);

            }
            dbCentrality.setSubCentralityList(subCentralityList);
        }
        return list;
    }

    /**
     * 分页查询
     */
    public PageInfo<Centrality> selectPage(Centrality centrality, Integer pageNum, Integer pageSize) {
        PageHelper.startPage(pageNum, pageSize);
        List<Centrality> list = selectAll(centrality);
        return PageInfo.of(list);
    }

    public List<Map<String, Object>> getDailyCounts() {
        // 从数据库获取有数据的日期统计
        List<Map<String, Object>> rawData = centralityMapper.getDailyCounts();

        // 将查询结果转换为 Map，方便查找
        Map<String, Integer> dataMap = rawData.stream()
                .collect(Collectors.toMap(
                        map -> map.get("date").toString(),
                        map -> Integer.parseInt(map.get("total").toString())
                ));

        // 生成最近 30 天的日期范围
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



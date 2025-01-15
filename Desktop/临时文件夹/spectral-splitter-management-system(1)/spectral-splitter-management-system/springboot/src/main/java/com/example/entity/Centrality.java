package com.example.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;
import java.util.List;

/**
 *  资源中心
 */
@Data
@TableName("centrality")
public class Centrality implements Serializable  {

    private static final long serialVersionUID = 1L;

    /** id */
    @TableId(value = "id", type = IdType.AUTO)
    private Integer id;

    /** 工单号 */
    private String orderSn;

    /** 分光器 */
    private Integer equipmentId;

    /** 开始时间 */
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss", timezone = "GMT+8")
    private LocalDateTime startTime;

    /** 备注 */
    private String content;

    @TableField(exist = false)
    private Equipment equipment;

    @TableField(exist = false)
    private List<SubCentrality> subCentralityList;
}


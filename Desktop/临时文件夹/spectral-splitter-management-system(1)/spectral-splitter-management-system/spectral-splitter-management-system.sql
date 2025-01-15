/*
 Navicat Premium Data Transfer

 Source Server         : 本地MySQL5.7
 Source Server Type    : MySQL
 Source Server Version : 50719
 Source Host           : localhost:3306
 Source Schema         : spectral-splitter-management-system

 Target Server Type    : MySQL
 Target Server Version : 50719
 File Encoding         : 65001

 Date: 31/12/2024 13:21:52
*/

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
-- Table structure for admin
-- ----------------------------
DROP TABLE IF EXISTS `admin`;
CREATE TABLE `admin`  (
  `id` int(10) NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `username` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '用户名',
  `password` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '密码',
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '姓名',
  `avatar` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '头像',
  `role` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '角色标识',
  `phone` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '电话',
  `email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '邮箱',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 2 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '管理员' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of admin
-- ----------------------------
INSERT INTO `admin` VALUES (1, 'admin', 'admin', '管理员', 'http://localhost:20000/files/1704195436817-路飞.jpg', 'ADMIN', '13911223344', '123@qq.com');

-- ----------------------------
-- Table structure for centrality
-- ----------------------------
DROP TABLE IF EXISTS `centrality`;
CREATE TABLE `centrality`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `order_sn` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT '工单号',
  `equipment_id` int(11) NULL DEFAULT NULL COMMENT '分光器',
  `start_time` datetime NULL DEFAULT NULL COMMENT '开始时间',
  `content` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL COMMENT '备注',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 10 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = '资源中心' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of centrality
-- ----------------------------
INSERT INTO `centrality` VALUES (9, '1873784511139655680', 1, '2024-12-31 01:33:35', '222');

-- ----------------------------
-- Table structure for cuser
-- ----------------------------
DROP TABLE IF EXISTS `cuser`;
CREATE TABLE `cuser`  (
  `id` int(10) NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `username` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '用户名',
  `password` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '密码',
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '姓名',
  `avatar` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '头像',
  `role` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '角色标识',
  `phone` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '电话',
  `email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '邮箱',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 2 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '资源用户' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of cuser
-- ----------------------------
INSERT INTO `cuser` VALUES (1, 'zzz', 'zzz', '张三三', 'http://localhost:20000/files/1704195436817-路飞.jpg', 'CUSER', '13911223344', '123@qq.com');

-- ----------------------------
-- Table structure for customer
-- ----------------------------
DROP TABLE IF EXISTS `customer`;
CREATE TABLE `customer`  (
  `id` int(11) NOT NULL AUTO_INCREMENT COMMENT 'id',
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT '姓名',
  `address` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT '地址',
  `phone` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT '手机号',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 23 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = '客户' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of customer
-- ----------------------------
INSERT INTO `customer` VALUES (3, '张伟', '北京市海淀区', '13800138001');
INSERT INTO `customer` VALUES (4, '李娜', '上海市浦东新区', '13900139002');
INSERT INTO `customer` VALUES (5, '王强', '广州市天河区', '13700137003');
INSERT INTO `customer` VALUES (6, '刘洋', '深圳市福田区', '13600136004');
INSERT INTO `customer` VALUES (7, '陈婷', '武汉市洪山区', '13500135005');
INSERT INTO `customer` VALUES (8, '杨杰', '重庆市江北区', '13400134006');
INSERT INTO `customer` VALUES (9, '赵静', '天津市和平区', '13300133007');
INSERT INTO `customer` VALUES (10, '孙力', '南京市鼓楼区', '13200132008');
INSERT INTO `customer` VALUES (11, '周杰', '杭州市西湖区', '13100131009');
INSERT INTO `customer` VALUES (12, '吴涛', '成都市锦江区', '13000130010');
INSERT INTO `customer` VALUES (13, '郑丽', '郑州市金水区', '13900989011');
INSERT INTO `customer` VALUES (14, '冯浩', '青岛市市南区', '13800988012');
INSERT INTO `customer` VALUES (15, '何琳', '沈阳市和平区', '13700987013');
INSERT INTO `customer` VALUES (16, '郭鹏', '西安市雁塔区', '13600986014');
INSERT INTO `customer` VALUES (17, '高鹏', '大连市沙河口区', '13500985015');
INSERT INTO `customer` VALUES (18, '胡婷', '济南市历下区', '13400984016');
INSERT INTO `customer` VALUES (19, '蔡翔', '合肥市包河区', '13300983017');
INSERT INTO `customer` VALUES (20, '黄晓', '佛山市南海区', '13200982018');
INSERT INTO `customer` VALUES (21, '朱琳', '苏州市姑苏区', '13100981019');
INSERT INTO `customer` VALUES (22, '梁波', '南宁市青秀区', '13000980020');

-- ----------------------------
-- Table structure for equipment
-- ----------------------------
DROP TABLE IF EXISTS `equipment`;
CREATE TABLE `equipment`  (
  `id` int(11) NOT NULL AUTO_INCREMENT COMMENT 'id',
  `olt_code` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT 'OLT编码',
  `area` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT '区域',
  `classify` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT '业务类型',
  `olt_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT 'OLT名称',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 4 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = '分光器' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of equipment
-- ----------------------------
INSERT INTO `equipment` VALUES (1, 'ZJDYBH-FH10G-OLT0001', '江苏', '宽带', '百花10G烽火');
INSERT INTO `equipment` VALUES (2, 'ZJDYBH-FH10G-OLT0002', '江苏', '专线光纤宽带', '百花10G烽火');
INSERT INTO `equipment` VALUES (3, 'ZJDYBH-FH10G-OLT0003', '江苏', '宽带', '百花10G烽火');

-- ----------------------------
-- Table structure for equipment_customer
-- ----------------------------
DROP TABLE IF EXISTS `equipment_customer`;
CREATE TABLE `equipment_customer`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `equipment_id` int(11) NULL DEFAULT NULL COMMENT '设备id',
  `customer_id` int(11) NULL DEFAULT NULL COMMENT '客户id',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 6 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = '设备-客户' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of equipment_customer
-- ----------------------------
INSERT INTO `equipment_customer` VALUES (1, 1, 3);
INSERT INTO `equipment_customer` VALUES (2, 1, 4);
INSERT INTO `equipment_customer` VALUES (4, 1, 22);
INSERT INTO `equipment_customer` VALUES (5, 1, 21);

-- ----------------------------
-- Table structure for iam
-- ----------------------------
DROP TABLE IF EXISTS `iam`;
CREATE TABLE `iam`  (
  `id` int(10) NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `username` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '用户名',
  `password` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '密码',
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '姓名',
  `avatar` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '头像',
  `role` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '角色标识',
  `phone` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '电话',
  `email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '邮箱',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 3 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '用户' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of iam
-- ----------------------------
INSERT INTO `iam` VALUES (1, 'aaa', 'aaa', '李四', 'http://localhost:20000/files/1704195436817-路飞.jpg', 'IAM', '13911223344', '123@qq.com');
INSERT INTO `iam` VALUES (2, 'bbb', 'bbb', '王五', NULL, 'IAM', NULL, NULL);

-- ----------------------------
-- Table structure for orders
-- ----------------------------
DROP TABLE IF EXISTS `orders`;
CREATE TABLE `orders`  (
  `id` int(11) NOT NULL AUTO_INCREMENT COMMENT 'id',
  `order_sn` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT '工单号',
  `equipment_id` int(11) NULL DEFAULT NULL COMMENT '分光器',
  `start_time` datetime NULL DEFAULT NULL COMMENT '开始时间',
  `state` int(1) NULL DEFAULT NULL COMMENT '状态',
  `content` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL COMMENT '备注',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 6 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = '工单' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of orders
-- ----------------------------
INSERT INTO `orders` VALUES (5, '1873784511139655680', 1, '2024-12-31 01:33:35', 3, '1111');

-- ----------------------------
-- Table structure for sub_centrality
-- ----------------------------
DROP TABLE IF EXISTS `sub_centrality`;
CREATE TABLE `sub_centrality`  (
  `id` int(11) NOT NULL AUTO_INCREMENT COMMENT 'id',
  `centrality_id` int(11) NULL DEFAULT NULL COMMENT '资源id',
  `customer_id` int(11) NULL DEFAULT NULL COMMENT '客户',
  `user_id` int(11) NULL DEFAULT NULL COMMENT '客户经理',
  `iam_id` int(11) NULL DEFAULT NULL COMMENT '装维',
  `repair_time` datetime NULL DEFAULT NULL COMMENT '割接时间',
  `iam_content` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL COMMENT '装维反馈',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 29 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = '子资源' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of sub_centrality
-- ----------------------------
INSERT INTO `sub_centrality` VALUES (25, 9, 21, 1, 2, '2024-12-31 12:00:00', '111');
INSERT INTO `sub_centrality` VALUES (26, 9, 22, 1, 1, '2025-01-01 12:00:00', '111');
INSERT INTO `sub_centrality` VALUES (27, 9, 4, 1, 2, '2025-01-01 12:00:00', '111');
INSERT INTO `sub_centrality` VALUES (28, 9, 3, 1, 1, '2025-01-02 12:00:00', '111');

-- ----------------------------
-- Table structure for sub_orders
-- ----------------------------
DROP TABLE IF EXISTS `sub_orders`;
CREATE TABLE `sub_orders`  (
  `id` int(11) NOT NULL AUTO_INCREMENT COMMENT 'id',
  `order_id` int(11) NULL DEFAULT NULL COMMENT '订单id',
  `customer_id` int(11) NULL DEFAULT NULL COMMENT '客户',
  `user_id` int(11) NULL DEFAULT NULL COMMENT '客户经理',
  `iam_id` int(11) NULL DEFAULT NULL COMMENT '装维',
  `repair_time` datetime NULL DEFAULT NULL COMMENT '割接时间',
  `iam_content` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL COMMENT '装维反馈',
  `state` int(11) NULL DEFAULT NULL COMMENT '状态',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 5 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = '子工单' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of sub_orders
-- ----------------------------
INSERT INTO `sub_orders` VALUES (1, 5, 3, 1, 1, '2025-01-02 12:00:00', '111', 4);
INSERT INTO `sub_orders` VALUES (2, 5, 4, 1, 2, '2025-01-01 12:00:00', '111', 4);
INSERT INTO `sub_orders` VALUES (3, 5, 22, 1, 1, '2025-01-01 12:00:00', '111', 4);
INSERT INTO `sub_orders` VALUES (4, 5, 21, 1, 2, '2024-12-31 12:00:00', '111', 4);

-- ----------------------------
-- Table structure for user
-- ----------------------------
DROP TABLE IF EXISTS `user`;
CREATE TABLE `user`  (
  `id` int(10) NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `username` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '用户名',
  `password` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '密码',
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '姓名',
  `avatar` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '头像',
  `role` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '角色标识',
  `phone` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '电话',
  `email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '邮箱',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 2 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '用户' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of user
-- ----------------------------
INSERT INTO `user` VALUES (1, '111', '111', '张三', 'http://localhost:20000/files/1704195436817-路飞.jpg', 'USER', '13911223344', '123@qq.com');

SET FOREIGN_KEY_CHECKS = 1;

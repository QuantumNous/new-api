package com.example.common.enums;

public enum ResultCodeEnum {
    SUCCESS("200", "成功"),

    /**
     * 参数异常
     */
    PARAM_ERROR("400", "参数异常"),

    /**
     * 无效的token
     */
    TOKEN_INVALID_ERROR("401", "无效的token"),

    /**
     * token验证失败，请重新登录
     */
    TOKEN_CHECK_ERROR("401", "token验证失败，请重新登录"),

    /**
     * 参数缺失
     */
    PARAM_LOST_ERROR("4001", "参数缺失"),

    /**
     * 系统异常
     */
    SYSTEM_ERROR("500", "系统异常"),

    /**
     * 用户名已存在
     */
    USER_EXIST_ERROR("5001", "用户名已存在"),

    /**
     * 用户未登录
     */
    USER_NOT_LOGIN("5002", "用户未登录"),

    /**
     * 账号或密码错误
     */
    USER_ACCOUNT_ERROR("5003", "账号或密码错误"),

    /**
     * 用户不存在
     */
    USER_NOT_EXIST_ERROR("5004", "用户不存在"),

    /**
     * 原密码输入错误
     */
    PARAM_PASSWORD_ERROR("5005", "原密码输入错误"),

    ;

    public String code;
    public String msg;

    ResultCodeEnum(String code, String msg) {
        this.code = code;
        this.msg = msg;
    }
}

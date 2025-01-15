package com.example.common;

import com.example.common.enums.ResultCodeEnum;

public class Result {
    private String code;
    private String msg;
    private Object data;

    private Result(Object data) {
        this.data = data;
    }

    public Result() {
    }

    public static Result success() {
        Result tResult = new Result();
        tResult.setCode(ResultCodeEnum.SUCCESS.code);
        tResult.setMsg(ResultCodeEnum.SUCCESS.msg);
        return tResult;
    }

    public static Result success(Object data) {
        Result tResult = new Result (data);
        tResult.setCode(ResultCodeEnum.SUCCESS.code);
        tResult.setMsg(ResultCodeEnum.SUCCESS.msg);
        return tResult;
    }

    public static Result error() {
        Result tResult = new Result();
        tResult.setCode(ResultCodeEnum.SYSTEM_ERROR.code);
        tResult.setMsg(ResultCodeEnum.SYSTEM_ERROR.msg);
        return tResult;
    }

    public static Result error(String code, String msg) {
        Result tResult = new Result();
        tResult.setCode(code);
        tResult.setMsg(msg);
        return tResult;
    }

    public static Result error(ResultCodeEnum resultCodeEnum) {
        Result tResult = new Result();
        tResult.setCode(resultCodeEnum.code);
        tResult.setMsg(resultCodeEnum.msg);
        return tResult;
    }

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public String getMsg() {
        return msg;
    }

    public void setMsg(String msg) {
        this.msg = msg;
    }

    public Object getData() {
        return data;
    }

    public void setData(Object data) {
        this.data = data;
    }
}

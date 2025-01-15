package com.example.service;

import cn.hutool.core.util.ObjectUtil;
import com.example.common.enums.ResultCodeEnum;
import com.example.common.enums.RoleEnum;
import com.example.entity.Account;
import com.example.entity.Cuser;
import com.example.exception.CustomException;
import com.example.mapper.CuserMapper;
import com.example.utils.TokenUtils;
import com.github.pagehelper.PageHelper;
import com.github.pagehelper.PageInfo;
import org.springframework.stereotype.Service;

import javax.annotation.Resource;
import java.util.List;

/**
 * 资源用户业务处理
 **/
@Service
public class CuserService {

    @Resource
    private CuserMapper cuserMapper;

    /**
     * 新增
     */
    public void add(Cuser cuser) {
        cuserMapper.insert(cuser);
    }

    /**
     * 删除
     */
    public void deleteById(Integer id) {
        cuserMapper.deleteById(id);
    }

    /**
     * 批量删除
     */
    public void deleteBatch(List<Integer> ids) {
        for (Integer id : ids) {
            cuserMapper.deleteById(id);
        }
    }

    /**
     * 修改
     */
    public void updateById(Cuser cuser) {
        cuserMapper.updateById(cuser);
    }

    /**
     * 根据ID查询
     */
    public Cuser selectById(Integer id) {
        return cuserMapper.selectById(id);
    }

    /**
     * 查询所有
     */
    public List<Cuser> selectAll(Cuser cuser) {
        return cuserMapper.selectAll(cuser);
    }

    /**
     * 分页查询
     */
    public PageInfo<Cuser> selectPage(Cuser cuser, Integer pageNum, Integer pageSize) {
        PageHelper.startPage(pageNum, pageSize);
        List<Cuser> list = selectAll(cuser);
        return PageInfo.of(list);
    }

    /**
     * 登录
     */
    public Account login(Account account) {
        Account dbCuser = cuserMapper.selectByUsername(account.getUsername());
        if (ObjectUtil.isNull(dbCuser)) {
            throw new CustomException(ResultCodeEnum.USER_NOT_EXIST_ERROR);
        }
        if (!account.getPassword().equals(dbCuser.getPassword())) {
            throw new CustomException(ResultCodeEnum.USER_ACCOUNT_ERROR);
        }
        String tokenData = dbCuser.getId() + "-" + RoleEnum.CUSER.name();
        String token = TokenUtils.createToken(tokenData, dbCuser.getPassword());
        dbCuser.setToken(token);
        return dbCuser;
    }

    /**
     * 修改密码
     */
    public void updatePassword(Account account) {
        Cuser dbCuser = cuserMapper.selectByUsername(account.getUsername());
        if (ObjectUtil.isNull(dbCuser)) {
            throw new CustomException(ResultCodeEnum.USER_NOT_EXIST_ERROR);
        }
        if (!account.getPassword().equals(dbCuser.getPassword())) {
            throw new CustomException(ResultCodeEnum.PARAM_PASSWORD_ERROR);
        }
        dbCuser.setPassword(account.getNewPassword());
        cuserMapper.updateById(dbCuser);
    }
}



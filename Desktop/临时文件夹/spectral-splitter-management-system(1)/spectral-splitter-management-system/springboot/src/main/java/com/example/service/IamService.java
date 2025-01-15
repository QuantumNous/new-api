package com.example.service;

import cn.hutool.core.util.ObjectUtil;
import com.example.common.Constants;
import com.example.common.enums.ResultCodeEnum;
import com.example.common.enums.RoleEnum;
import com.example.entity.Account;
import com.example.entity.Iam;
import com.example.exception.CustomException;
import com.example.mapper.IamMapper;
import com.example.utils.TokenUtils;
import com.github.pagehelper.PageHelper;
import com.github.pagehelper.PageInfo;
import org.springframework.stereotype.Service;

import javax.annotation.Resource;
import java.util.List;

/**
 * 装维业务处理
 **/
@Service
public class IamService {

    @Resource
    private IamMapper iamMapper;

    /**
     * 新增
     */
    public void add(Iam iam) {
        Iam dbIam = iamMapper.selectByUsername(iam.getUsername());
        if (ObjectUtil.isNotNull(dbIam)) {
            throw new CustomException(ResultCodeEnum.USER_EXIST_ERROR);
        }
        if (ObjectUtil.isEmpty(iam.getPassword())) {
            iam.setPassword(Constants.USER_DEFAULT_PASSWORD);
        }
        if (ObjectUtil.isEmpty(iam.getName())) {
            iam.setName(iam.getUsername());
        }
        iam.setRole(RoleEnum.IAM.name());
        iamMapper.insert(iam);
    }

    /**
     * 删除
     */
    public void deleteById(Integer id) {
        iamMapper.deleteById(id);
    }

    /**
     * 批量删除
     */
    public void deleteBatch(List<Integer> ids) {
        for (Integer id : ids) {
            iamMapper.deleteById(id);
        }
    }

    /**
     * 修改
     */
    public void updateById(Iam iam) {
        iamMapper.updateById(iam);
    }

    /**
     * 根据ID查询
     */
    public Iam selectById(Integer id) {
        return iamMapper.selectById(id);
    }

    /**
     * 查询所有
     */
    public List<Iam> selectAll(Iam iam) {
        return iamMapper.selectAll(iam);
    }

    /**
     * 分页查询
     */
    public PageInfo<Iam> selectPage(Iam iam, Integer pageNum, Integer pageSize) {
        PageHelper.startPage(pageNum, pageSize);
        List<Iam> list = selectAll(iam);
        return PageInfo.of(list);
    }

    /**
     * 登录
     */
    public Account login(Account account) {
        Account dbIam = iamMapper.selectByUsername(account.getUsername());
        if (ObjectUtil.isNull(dbIam)) {
            throw new CustomException(ResultCodeEnum.USER_NOT_EXIST_ERROR);
        }
        if (!account.getPassword().equals(dbIam.getPassword())) {
            throw new CustomException(ResultCodeEnum.USER_ACCOUNT_ERROR);
        }
        String tokenData = dbIam.getId() + "-" + RoleEnum.IAM.name();
        String token = TokenUtils.createToken(tokenData, dbIam.getPassword());
        dbIam.setToken(token);
        return dbIam;
    }

    /**
     * 修改密码
     */
    public void updatePassword(Account account) {
        Iam dbIam = iamMapper.selectByUsername(account.getUsername());
        if (ObjectUtil.isNull(dbIam)) {
            throw new CustomException(ResultCodeEnum.USER_NOT_EXIST_ERROR);
        }
        if (!account.getPassword().equals(dbIam.getPassword())) {
            throw new CustomException(ResultCodeEnum.PARAM_PASSWORD_ERROR);
        }
        dbIam.setPassword(account.getNewPassword());
        iamMapper.updateById(dbIam);
    }

}
package com.example.utils;

import cn.hutool.core.date.DateUtil;
import cn.hutool.core.util.ObjectUtil;
import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import com.example.common.Constants;
import com.example.common.enums.RoleEnum;
import com.example.entity.Account;
import com.example.service.AdminService;
import com.example.service.CuserService;
import com.example.service.IamService;
import com.example.service.UserService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import javax.annotation.PostConstruct;
import javax.annotation.Resource;
import javax.servlet.http.HttpServletRequest;
import java.util.Date;

/**
 * Token工具类
 */
@Component
public class TokenUtils {

    private static final Logger log = LoggerFactory.getLogger(TokenUtils.class);

    private static AdminService staticAdminService;
    private static UserService staticUserService;
    private static IamService staticIamService;
    private static CuserService staticCuserService;

    @Resource
    AdminService adminService;
    @Resource
    UserService userService;
    @Resource
    IamService iamService;
    @Resource
    CuserService cuserService;

    @PostConstruct
    public void setUserService() {
        staticAdminService = adminService;
        staticUserService = userService;
        staticIamService = iamService;
        staticCuserService = cuserService;
    }

    /**
     * 生成token
     */
    public static String createToken(String data, String sign) {
        return JWT.create().withAudience(data)
                .withExpiresAt(DateUtil.offsetHour(new Date(), 2))
                .sign(Algorithm.HMAC256(sign));
    }

    /**
     * 获取当前登录的用户信息
     */
    public static Account getCurrentUser() {
        try {
            HttpServletRequest request = ((ServletRequestAttributes) RequestContextHolder.getRequestAttributes()).getRequest();
            String token = request.getHeader(Constants.TOKEN);
            if (ObjectUtil.isNotEmpty(token)) {
                String userRole = JWT.decode(token).getAudience().get(0);
                String userId = userRole.split("-")[0];
                String role = userRole.split("-")[1];
                if (RoleEnum.ADMIN.name().equals(role)) {
                    return staticAdminService.selectById(Integer.valueOf(userId));
                }
                if (RoleEnum.USER.name().equals(role)) {
                    return staticUserService.selectById(Integer.valueOf(userId));
                }
                if (RoleEnum.IAM.name().equals(role)) {
                    return staticIamService.selectById(Integer.valueOf(userId));
                }
                if (RoleEnum.CUSER.name().equals(role)) {
                    return staticCuserService.selectById(Integer.valueOf(userId));
                }
            }
        } catch (Exception e) {
            log.error("获取当前用户信息出错", e);
        }
        return new Account();
    }
}


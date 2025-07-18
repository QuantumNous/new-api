import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { generateToken } from '../_lib/auth.js';
import { updateUserCache } from '../_lib/cache.js';

const prisma = new PrismaClient();

// Corresponds to the Login function in controller/user.go
export async function onRequestPost(context) {
  try {
    const { request } = context;
    const body = await request.json();

    const username = body.username;
    const password = body.password;

    if (!username || !password) {
      return new Response(JSON.stringify({
        success: false,
        message: "无效的参数",
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Find user by username or email
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: username },
          { email: username }, // In the original logic, username can also be an email
        ],
      },
    });

    if (!user) {
      return new Response(JSON.stringify({
        success: false,
        message: "用户名或密码错误",
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check password
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return new Response(JSON.stringify({
        success: false,
        message: "用户名或密码错误",
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // In the original logic, status 1 means enabled
    if (user.status !== 1) {
        return new Response(JSON.stringify({
            success: false,
            message: "用户已被封禁",
        }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    // Clean sensitive data before returning, similar to setupLogin
    const { password: _, ...userData } = user;
    
    // Generate JWT
    const token = generateToken(user);

    // Update user cache
    await updateUserCache(user);

    return new Response(JSON.stringify({
      success: true,
      message: "登录成功",
      data: { ...userData, token: token },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({
      success: false,
      message: "内部服务器错误: " + error.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
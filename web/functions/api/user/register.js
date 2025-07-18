import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Corresponds to the Register function in controller/user.go
export async function onRequestPost(context) {
  try {
    const { request } = context;
    const body = await request.json();

    const username = body.username;
    const password = body.password;
    const email = body.email;

    if (!username || !password) {
      return new Response(JSON.stringify({
        success: false,
        message: "无效的参数",
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username: username },
          { email: email },
        ],
      },
    });

    if (existingUser) {
      return new Response(JSON.stringify({
        success: false,
        message: "用户名或邮箱已存在",
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const newUser = await prisma.user.create({
      data: {
        username: username,
        password: hashedPassword,
        email: email,
        displayName: username,
        // Set other default values as needed from the schema
      },
    });

    return new Response(JSON.stringify({
      success: true,
      message: "注册成功",
      data: {
        id: newUser.id,
        username: newUser.username,
        role: newUser.role,
        status: newUser.status,
      }
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
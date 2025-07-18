import { withAuth } from '../_lib/auth.js';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { invalidateUserCache } from '../_lib/cache.js';

const prisma = new PrismaClient();

// This handler is protected by the withAuth wrapper.
// It will only be executed if the user is authenticated.
async function getSelfHandler(context) {
  // The authenticated user object is added to the context by withAuth
  const { user } = context;

  // Clean sensitive data before returning
  const { password, ...userData } = user;

  return new Response(JSON.stringify({
    success: true,
    message: "",
    data: userData,
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function updateSelfHandler(context) {
  try {
    const { request, user } = context;
    const body = await request.json();

    const updateData = {};

    // Fields that the user is allowed to update
    if (body.display_name) {
      updateData.displayName = body.display_name;
    }
    if (body.email) {
      // You might want to add email validation here
      updateData.email = body.email;
    }
    if (body.password) {
        // Add verification for original password if needed
        updateData.password = await bcrypt.hash(body.password, 10);
    }
    if (body.setting) {
        updateData.setting = JSON.stringify(body.setting);
    }
    if (body.remark) {
        updateData.remark = body.remark;
    }


    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: updateData,
    });
    
    // Invalidate cache after update
    await invalidateUserCache(user.id);

    const { password, ...userData } = updatedUser;

    return new Response(JSON.stringify({
      success: true,
      message: "用户信息更新成功",
      data: userData,
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


// Wrap the handler with the authentication middleware
export const onRequestGet = withAuth(getSelfHandler);
export const onRequestPut = withAuth(updateSelfHandler);
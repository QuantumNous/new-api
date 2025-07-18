import { PrismaClient } from '@prisma/client';
import { withAdminAuth } from '../_lib/auth.js';
import bcrypt from 'bcryptjs';
import { getUserCache, invalidateUserCache, updateUserCache } from '../_lib/cache.js';

const prisma = new PrismaClient();

// Handler for GET /api/user/ and GET /api/user/{id} and Search
async function handleGet(context) {
  const { request, params } = context;
  const id = params.id ? parseInt(params.id[0]) : null;

  if (id) {
    // Get user by ID, with cache
    let user = await getUserCache(id);
    if (!user) {
        user = await prisma.user.findUnique({ where: { id } });
        if(user) {
            await updateUserCache(user);
        }
    }
    if (!user) {
      return new Response(JSON.stringify({ success: false, message: '用户不存在' }), { status: 404 });
    }
    const { password, ...userData } = user;
    return new Response(JSON.stringify({ success: true, message: '', data: userData }));
  }

  // Get all users or search users
  const url = new URL(request.url);
  const keyword = url.searchParams.get('keyword');
  
  if (keyword) {
    // Search users
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { username: { contains: keyword, mode: 'insensitive' } },
          { email: { contains: keyword, mode: 'insensitive' } },
          { displayName: { contains: keyword, mode: 'insensitive' } },
        ],
      },
      select: { id: true, username: true, displayName: true, role: true, status: true, email: true, quota: true, usedQuota: true, createdAt: true },
    });
    return new Response(JSON.stringify({ success: true, message: '', data: users }));
  }
  
  // Get all users with pagination
  const page = parseInt(url.searchParams.get('p') || '1');
  const pageSize = 10;
  const users = await prisma.user.findMany({
    skip: (page - 1) * pageSize,
    take: pageSize,
    orderBy: { id: 'desc' },
    select: { id: true, username: true, displayName: true, role: true, status: true, email: true, quota: true, usedQuota: true, createdAt: true },
  });
  const total = await prisma.user.count();

  return new Response(JSON.stringify({ success: true, message: '', data: { data: users, total: total } }));
}

// Handler for POST /api/user/ (Create User)
async function handlePost(context) {
    const { request } = context;
    const body = await request.json();
    const { username, password, ...otherData } = body;

    if (!username || !password) {
        return new Response(JSON.stringify({ success: false, message: '用户名和密码不能为空' }), { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await prisma.user.create({
        data: {
            username,
            password: hashedPassword,
            displayName: otherData.display_name || username,
            ...otherData
        }
    });
    
    const { password: _, ...userData } = newUser;
    return new Response(JSON.stringify({ success: true, message: '用户创建成功', data: userData }), { status: 201 });
}

// Handler for PUT /api/user/{id} (Update User)
async function handlePut(context) {
    const { request, params } = context;
    const id = parseInt(params.id[0]);
    const body = await request.json();
    const { password, ...updateData } = body;

    if (password) {
        updateData.password = await bcrypt.hash(password, 10);
    }

    const updatedUser = await prisma.user.update({
        where: { id },
        data: updateData,
    });
    
    await invalidateUserCache(id);
    const { password: _, ...userData } = updatedUser;
    return new Response(JSON.stringify({ success: true, message: '用户信息更新成功', data: userData }));
}

// Handler for DELETE /api/user/{id} (Delete User)
async function handleDelete(context) {
    const { params } = context;
    const id = parseInt(params.id[0]);
    
    // Using soft delete by updating deletedAt
    // await prisma.user.delete({ where: { id } }); // for hard delete
    await prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() }
    });
    
    await invalidateUserCache(id);

    return new Response(JSON.stringify({ success: true, message: '用户删除成功' }));
}

export const onRequestGet = withAdminAuth(handleGet);
export const onRequestPost = withAdminAuth(handlePost);
export const onRequestPut = withAdminAuth(handlePut);
export const onRequestDelete = withAdminAuth(handleDelete);
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { getUserCache, updateUserCache } from './cache.js';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'your-default-secret'; // Should be in environment variables

/**
 * A higher-order function to protect routes that require authentication.
 * @param {Function} handler - The original onRequest function to be protected.
 * @returns {Function} A new onRequest function with authentication check.
 */
export function withAuth(handler) {
  return async (context) => {
    const { request } = context;
    const authHeader = request.headers.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({
        success: false,
        message: '未授权：缺少 Token',
      }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    const token = authHeader.split(' ')[1];

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const userId = decoded.id;

      // 1. Try to get user from cache first
      let user = await getUserCache(userId);

      if (!user) {
        // 2. If not in cache, get from DB
        user = await prisma.user.findUnique({ where: { id: userId } });
        if (user) {
          // 3. Populate cache
          await updateUserCache(user);
        }
      }
      
      if (!user || user.status !== 1) {
        return new Response(JSON.stringify({
          success: false,
          message: '未授权：用户不存在或已被封禁',
        }), { status: 401, headers: { 'Content-Type': 'application/json' } });
      }

      // Add user to the context for the handler to use
      context.user = user;

      return handler(context);
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        message: '未授权：无效的 Token',
      }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }
  };
}

/**
 * Generates a JWT for a given user.
 * @param {object} user - The user object.
 * @returns {string} The generated JWT.
 */
export function generateToken(user) {
  return jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, {
    expiresIn: '7d', // Token expires in 7 days
  });
}

/**
 * A higher-order function to protect routes that require admin privileges.
 * It first checks for authentication, then checks for the admin role.
 * In the original project, role >= 100 means admin.
 * @param {Function} handler - The original onRequest function to be protected.
 * @returns {Function} A new onRequest function with admin check.
 */
export function withAdminAuth(handler) {
  return withAuth(async (context) => {
    const { user } = context;

    // Assuming role 100 is Admin and 101 is Root, as per original project's constants.
    if (user.role < 100) {
      return new Response(JSON.stringify({
        success: false,
        message: '权限不足',
      }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    }

    return handler(context);
  });
}
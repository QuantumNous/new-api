import Redis from 'ioredis';

// Initialize Redis client from a single environment variable
// This must be set in your deployment platform (Vercel, Cloudflare, etc.)
// Example: rediss://default:password@hostname:port
let redis;
if (process.env.REDIS_URL) {
    redis = new Redis(process.env.REDIS_URL);
}

const CACHE_EXPIRATION = 60 * 60; // 1 hour

/**
 * Generates the Redis key for a user.
 * @param {number} userId - The ID of the user.
 * @returns {string} The Redis key.
 */
function getUserCacheKey(userId) {
  return `user:${userId}`;
}

/**
 * Caches the user's entire data.
 * @param {object} user - The user object from Prisma.
 */
export async function updateUserCache(user) {
  if (!redis) return; // Do nothing if Redis is not configured
  try {
    const key = getUserCacheKey(user.id);
    await redis.setex(key, CACHE_EXPIRATION, JSON.stringify(user));
  } catch (error) {
    console.error(`Failed to update user cache for user ${user.id}:`, error);
  }
}

/**
 * Retrieves a user from the cache.
 * @param {number} userId - The ID of the user.
 * @returns {Promise<object|null>} The cached user object, or null if not found.
 */
export async function getUserCache(userId) {
    if (!redis) return null;
    try {
        const key = getUserCacheKey(userId);
        const data = await redis.get(key);
        return data ? JSON.parse(data) : null;
    } catch (error) {
        console.error(`Failed to get user cache for user ${userId}:`, error);
        return null;
    }
}

/**
 * Invalidates (deletes) a user's cache.
 * @param {number} userId - The ID of the user.
 */
export async function invalidateUserCache(userId) {
  if (!redis) return;
  try {
    const key = getUserCacheKey(userId);
    await redis.del(key);
  } catch (error) {
    console.error(`Failed to invalidate cache for user ${userId}:`, error);
  }
}
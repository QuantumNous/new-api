import { PrismaClient } from '@prisma/client';
import { withAuth } from '../_lib/auth.js';
import { randomBytes } from 'crypto';

const prisma = new PrismaClient();

// Handler for GET /api/user/token (Generate Access Token)
async function handleGet(context) {
    const { user } = context;

    // Generate a new random token
    const newAccessToken = randomBytes(16).toString('hex');

    await prisma.user.update({
        where: { id: user.id },
        data: { accessToken: newAccessToken },
    });

    return new Response(JSON.stringify({
        success: true,
        message: '令牌已重置',
        data: newAccessToken,
    }));
}

export const onRequestGet = withAuth(handleGet);
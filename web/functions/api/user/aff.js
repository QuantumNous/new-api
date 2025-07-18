import { PrismaClient } from '@prisma/client';
import { withAuth } from '../_lib/auth.js';

const prisma = new PrismaClient();

// Handler for GET /api/user/aff
async function handleGet(context) {
    const { user } = context;
    return new Response(JSON.stringify({
        success: true,
        message: '',
        data: {
            aff_code: user.affCode,
            aff_quota: user.affQuota,
        }
    }));
}

// Handler for POST /api/user/aff (Transfer AffQuota to Quota)
async function handlePost(context) {
    const { request, user } = context;
    const body = await request.json();
    const quotaToTransfer = parseInt(body.quota);

    if (!quotaToTransfer || quotaToTransfer <= 0) {
        return new Response(JSON.stringify({ success: false, message: '无效的额度' }), { status: 400 });
    }

    if (user.affQuota < quotaToTransfer) {
        return new Response(JSON.stringify({ success: false, message: '邀请额度不足' }), { status: 400 });
    }
    
    // Using Prisma's atomic operations
    const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: {
            affQuota: {
                decrement: quotaToTransfer
            },
            quota: {
                increment: quotaToTransfer
            }
        }
    });

    return new Response(JSON.stringify({
        success: true,
        message: '额度转换成功',
        data: {
            quota: updatedUser.quota,
            aff_quota: updatedUser.affQuota,
        }
    }));
}

export const onRequestGet = withAuth(handleGet);
export const onRequestPost = withAuth(handlePost);
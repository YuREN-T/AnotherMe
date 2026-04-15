import { NextRequest } from 'next/server';
import {
  createGatewayConversation,
  DEFAULT_CHAT_USER_ID,
  isAnotherMe2GatewayError,
  listGatewayConversations,
} from '@/lib/server/anotherme2-gateway';
import { apiError, apiSuccess } from '@/lib/server/api-response';

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get('userId') || DEFAULT_CHAT_USER_ID;
    const limit = Number(request.nextUrl.searchParams.get('limit') || '50');
    const conversations = await listGatewayConversations({
      userId,
      limit: Number.isFinite(limit) ? limit : 50,
    });
    return apiSuccess({ conversations });
  } catch (error) {
    if (isAnotherMe2GatewayError(error)) {
      return apiError('UPSTREAM_ERROR', error.status, error.message);
    }
    return apiError(
      'INTERNAL_ERROR',
      500,
      error instanceof Error ? error.message : 'Failed to list conversations',
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      userId?: string;
      type?: string;
      name?: string;
      creatorId?: string;
      memberIds?: string[];
    };

    const userId = (body.userId || DEFAULT_CHAT_USER_ID).trim();
    const name = (body.name || '').trim();
    if (!name) {
      return apiError('MISSING_REQUIRED_FIELD', 400, 'name is required');
    }

    const conversation = await createGatewayConversation({
      userId,
      type: body.type || 'single',
      name,
      creatorId: body.creatorId,
      memberIds: body.memberIds,
    });

    return apiSuccess({ conversation }, 201);
  } catch (error) {
    if (isAnotherMe2GatewayError(error)) {
      return apiError('UPSTREAM_ERROR', error.status, error.message);
    }
    return apiError(
      'INTERNAL_ERROR',
      500,
      error instanceof Error ? error.message : 'Failed to create conversation',
    );
  }
}

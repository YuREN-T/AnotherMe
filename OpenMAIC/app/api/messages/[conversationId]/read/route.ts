import { NextRequest } from 'next/server';
import {
  isAnotherMe2GatewayError,
  markGatewayConversationRead,
} from '@/lib/server/anotherme2-gateway';
import { apiError, apiSuccess } from '@/lib/server/api-response';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ conversationId: string }> },
) {
  try {
    const { conversationId } = await context.params;
    if (!conversationId) {
      return apiError('INVALID_REQUEST', 400, 'Missing conversation id');
    }

    const body = (await request.json()) as {
      userId?: string;
      lastReadSeq?: number;
    };

    const userId = (body.userId || '').trim();
    if (!userId) {
      return apiError('MISSING_REQUIRED_FIELD', 400, 'userId is required');
    }

    const readState = await markGatewayConversationRead({
      conversationId,
      userId,
      lastReadSeq: body.lastReadSeq,
    });

    return apiSuccess({ readState });
  } catch (error) {
    if (isAnotherMe2GatewayError(error)) {
      return apiError('UPSTREAM_ERROR', error.status, error.message);
    }
    return apiError(
      'INTERNAL_ERROR',
      500,
      error instanceof Error ? error.message : 'Failed to mark conversation read',
    );
  }
}

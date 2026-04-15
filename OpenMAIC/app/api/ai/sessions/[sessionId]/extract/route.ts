import { NextRequest } from 'next/server';
import {
  createLearningRecordExtractJob,
  DEFAULT_CHAT_USER_ID,
  isAnotherMe2GatewayError,
} from '@/lib/server/anotherme2-gateway';
import { apiError, apiSuccess } from '@/lib/server/api-response';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { sessionId } = await context.params;
    if (!sessionId) {
      return apiError('INVALID_REQUEST', 400, 'Missing session id');
    }

    const body = (await request.json().catch(() => ({}))) as {
      userId?: string;
      extractVersion?: string;
    };

    const job = await createLearningRecordExtractJob({
      sessionId,
      userId: (body.userId || DEFAULT_CHAT_USER_ID).trim(),
      extractVersion: body.extractVersion,
    });

    return apiSuccess(
      {
        jobId: job.job_id,
        status: job.status,
        step: job.step,
        progress: job.progress,
      },
      202,
    );
  } catch (error) {
    if (isAnotherMe2GatewayError(error)) {
      return apiError('UPSTREAM_ERROR', error.status, error.message);
    }
    return apiError(
      'INTERNAL_ERROR',
      500,
      error instanceof Error ? error.message : 'Failed to enqueue learning extract job',
    );
  }
}

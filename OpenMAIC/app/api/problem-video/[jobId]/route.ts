import { type NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import {
  getAnotherMe2Job,
  getAnotherMe2ProblemVideoResult,
  isAnotherMe2GatewayError,
} from '@/lib/server/anotherme2-gateway';

export const maxDuration = 30;

function normalizeResult(result: Awaited<ReturnType<typeof getAnotherMe2ProblemVideoResult>>) {
  return {
    videoUrl: result.video_url,
    durationSec: result.duration_sec,
    scriptStepsCount: result.script_steps_count,
    debugBundleUrl: result.debug_bundle_url || null,
  };
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ jobId: string }> },
) {
  try {
    const { jobId } = await context.params;
    if (!jobId) {
      return apiError('INVALID_REQUEST', 400, 'Missing job id');
    }

    const job = await getAnotherMe2Job(jobId);
    const payload: Record<string, unknown> = {
      jobId: job.job_id,
      status: job.status,
      step: job.step,
      progress: job.progress,
      errorMessage: job.error_message || null,
    };

    if (job.status === 'succeeded') {
      payload.result = normalizeResult(await getAnotherMe2ProblemVideoResult(jobId));
    }

    return apiSuccess(payload);
  } catch (error) {
    if (isAnotherMe2GatewayError(error)) {
      return apiError('UPSTREAM_ERROR', error.status, error.message);
    }
    return apiError(
      'INTERNAL_ERROR',
      500,
      error instanceof Error ? error.message : 'Failed to query AnotherMe2 problem video job',
    );
  }
}

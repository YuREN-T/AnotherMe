"""Queue worker for gateway jobs."""

from __future__ import annotations

import time

from .config import get_settings
from .db import init_db, reconfigure_db, session_scope
from .job_service import dequeue_next_queued_job, handle_worker_message
from .queueing import build_queue_client
from .storage import build_storage


def run_worker() -> None:
    settings = get_settings()
    reconfigure_db(settings.database_url)
    init_db()

    queue_client = build_queue_client(settings)
    storage = build_storage(settings)
    queue_order = [
        settings.queue_package,
        settings.queue_problem_video,
        settings.queue_course,
        settings.queue_learning_record,
    ]
    queue_backend = getattr(queue_client, "backend", "redis")

    print(f"[gateway-worker] started, queues={queue_order}, backend={queue_backend}")

    while True:
        idle_sleep_seconds = 0.0
        with session_scope() as session:
            if queue_backend == "polling":
                message = dequeue_next_queued_job(session, queue_order)
                if not message:
                    idle_sleep_seconds = 0.3
                    message = None
            else:
                item = queue_client.dequeue(queue_order, timeout=3)
                if not item:
                    idle_sleep_seconds = 0.1
                    message = None
                else:
                    _queue_name, message = item

            if not message:
                continue

            handle_worker_message(
                session=session,
                queue_client=queue_client,
                message=message,
                settings=settings,
                storage=storage,
            )

        if idle_sleep_seconds > 0:
            time.sleep(idle_sleep_seconds)


if __name__ == "__main__":
    run_worker()

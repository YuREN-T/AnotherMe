"""FastAPI app exposing unified backend job APIs."""

from __future__ import annotations

from pathlib import Path
from uuid import uuid4

from fastapi import Depends, FastAPI, File, Header, HTTPException, Query, UploadFile
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from .chat_service import (
    create_ai_message,
    create_ai_session,
    create_conversation,
    create_message,
    list_ai_messages,
    list_ai_sessions,
    list_conversations,
    list_messages,
    mark_conversation_read,
    serialize_ai_feedback,
    serialize_ai_message,
    serialize_ai_session,
    serialize_conversation,
    serialize_message,
    upsert_ai_feedback,
)
from .config import Settings, get_settings
from .db import get_db, init_db, reconfigure_db
from .job_service import create_or_get_job, serialize_job
from .models import Conversation, Job
from .queueing import build_queue_client
from .schemas import (
    AIChatMessageOutput,
    AIChatSessionSummary,
    AIMessageFeedbackOutput,
    AIMessageFeedbackRequest,
    ConversationReadResponse,
    ConversationSummary,
    CreateAIChatMessageRequest,
    CreateAIChatSessionRequest,
    CreateConversationRequest,
    CreateJobRequest,
    CreateMessageRequest,
    JobResultResponse,
    JobStatus,
    JobSummary,
    MarkConversationReadRequest,
    MessageOutput,
    UploadResponse,
)
from .storage import ObjectStorage, build_storage, guess_content_type


class QueueClientProtocol:
    def enqueue(self, queue_name, message):
        raise NotImplementedError

    def ping(self):
        raise NotImplementedError


def _require_token(settings: Settings, auth_header: str | None) -> None:
    if not settings.api_token:
        return
    expected = f"Bearer {settings.api_token}"
    if auth_header != expected:
        raise HTTPException(status_code=401, detail={"error_code": "UNAUTHORIZED", "message": "Invalid token"})


def create_app(
    settings_override: Settings | None = None,
    queue_client_override: QueueClientProtocol | None = None,
    storage_override: ObjectStorage | None = None,
) -> FastAPI:
    settings = settings_override or get_settings()
    app = FastAPI(title=settings.app_name)

    queue_client = queue_client_override or build_queue_client(settings)
    storage = storage_override or build_storage(settings)

    @app.on_event("startup")
    def startup_event() -> None:
        Path(settings.worker_temp_root).mkdir(parents=True, exist_ok=True)
        reconfigure_db(settings.database_url)
        init_db()

    @app.get("/")
    def root() -> dict:
        """Avoid 404 noise when browsers or probes hit the gateway base URL."""
        return {
            "service": settings.app_name,
            "ok": True,
            "health": "/healthz",
            "api": "/v1/jobs",
        }

    @app.get("/healthz")
    def healthz() -> dict:
        redis_ok = False
        try:
            redis_ok = bool(queue_client.ping())
        except Exception:
            redis_ok = False
        return {
            "ok": True,
            "redis": redis_ok,
            "queue_backend": getattr(queue_client, "backend", "redis" if redis_ok else "polling"),
            "env": settings.app_env,
        }

    @app.post("/v1/uploads", response_model=UploadResponse)
    async def upload_problem_image(
        file: UploadFile = File(...),
        authorization: str | None = Header(default=None),
    ):
        _require_token(settings, authorization)

        if not file.filename:
            raise HTTPException(status_code=400, detail={"error_code": "INVALID_FILE", "message": "Missing filename"})

        object_key = f"uploads/{uuid4().hex}_{file.filename}"
        content_type = file.content_type or guess_content_type(file.filename)
        url = storage.upload_stream(file.file, object_key, content_type=content_type)

        # Try to infer size by reading uploaded stream length from file descriptor.
        size = 0
        try:
            current = file.file.tell()
            file.file.seek(0, 2)
            size = file.file.tell()
            file.file.seek(current)
        except Exception:
            size = 0

        return UploadResponse(object_key=object_key, url=url, size=size, content_type=content_type)

    @app.post("/v1/jobs", response_model=JobSummary)
    def create_job(
        request: CreateJobRequest,
        db: Session = Depends(get_db),
        authorization: str | None = Header(default=None),
    ):
        _require_token(settings, authorization)
        try:
            job, _created = create_or_get_job(db, queue_client, request, settings)
            db.commit()
            db.refresh(job)
            return JobSummary(**serialize_job(job))
        except Exception as exc:
            db.rollback()
            raise HTTPException(
                status_code=400,
                detail={"error_code": "INVALID_JOB_PAYLOAD", "message": str(exc)},
            )

    @app.get("/v1/jobs/{job_id}", response_model=JobSummary)
    def get_job(job_id: str, db: Session = Depends(get_db), authorization: str | None = Header(default=None)):
        _require_token(settings, authorization)
        job = db.get(Job, job_id)
        if not job:
            raise HTTPException(status_code=404, detail={"error_code": "JOB_NOT_FOUND", "message": "Job not found"})
        return JobSummary(**serialize_job(job))

    @app.get("/v1/jobs/{job_id}/result", response_model=JobResultResponse)
    def get_job_result(job_id: str, db: Session = Depends(get_db), authorization: str | None = Header(default=None)):
        _require_token(settings, authorization)
        job = db.get(Job, job_id)
        if not job:
            raise HTTPException(status_code=404, detail={"error_code": "JOB_NOT_FOUND", "message": "Job not found"})

        if job.status != JobStatus.SUCCEEDED.value:
            raise HTTPException(
                status_code=409,
                detail={"error_code": "JOB_NOT_READY", "message": f"Job status={job.status}"},
            )

        return JobResultResponse(job_id=job.id, status=JobStatus(job.status), result=job.result_payload or {})

    @app.get("/v1/messages/conversations", response_model=list[ConversationSummary])
    def get_conversations(
        user_id: str = Query(..., min_length=1),
        limit: int = Query(50, ge=1, le=200),
        db: Session = Depends(get_db),
        authorization: str | None = Header(default=None),
    ):
        _require_token(settings, authorization)
        return [ConversationSummary(**row) for row in list_conversations(db, user_id=user_id, limit=limit)]

    @app.post("/v1/messages/conversations", response_model=ConversationSummary)
    def create_conversation_api(
        request: CreateConversationRequest,
        db: Session = Depends(get_db),
        authorization: str | None = Header(default=None),
    ):
        _require_token(settings, authorization)
        conversation = create_conversation(
            db,
            user_id=request.user_id,
            conversation_type=request.type,
            name=request.name,
            creator_id=request.creator_id,
            member_ids=request.member_ids,
        )
        db.commit()
        db.refresh(conversation)

        row = (
            db.query(Conversation)
            .filter(Conversation.id == conversation.id)
            .first()
        )
        return ConversationSummary(**serialize_conversation(row, unread_count=0))

    @app.get("/v1/messages/{conversation_id}/messages", response_model=list[MessageOutput])
    def get_messages(
        conversation_id: str,
        limit: int = Query(100, ge=1, le=500),
        before_seq: int | None = Query(default=None),
        db: Session = Depends(get_db),
        authorization: str | None = Header(default=None),
    ):
        _require_token(settings, authorization)
        return [MessageOutput(**row) for row in list_messages(db, conversation_id, limit=limit, before_seq=before_seq)]

    @app.post("/v1/messages/{conversation_id}/messages", response_model=MessageOutput)
    def create_message_api(
        conversation_id: str,
        request: CreateMessageRequest,
        db: Session = Depends(get_db),
        authorization: str | None = Header(default=None),
    ):
        _require_token(settings, authorization)
        message, attachments = create_message(
            db,
            conversation_id=conversation_id,
            sender_id=request.sender_id,
            message_type=request.message_type,
            content=request.content,
            reply_to_message_id=request.reply_to_message_id,
            status=request.status,
            source_type=request.source_type,
            source_ref_id=request.source_ref_id,
            attachments=[
                item.model_dump() if hasattr(item, "model_dump") else item.dict()
                for item in request.attachments
            ],
        )
        db.commit()
        return MessageOutput(**serialize_message(message, attachments))

    @app.post("/v1/messages/{conversation_id}/read", response_model=ConversationReadResponse)
    def mark_read_api(
        conversation_id: str,
        request: MarkConversationReadRequest,
        db: Session = Depends(get_db),
        authorization: str | None = Header(default=None),
    ):
        _require_token(settings, authorization)
        result = mark_conversation_read(
            db,
            conversation_id=conversation_id,
            user_id=request.user_id,
            last_read_seq=request.last_read_seq,
        )
        db.commit()
        return ConversationReadResponse(**result)

    @app.get("/v1/ai/sessions", response_model=list[AIChatSessionSummary])
    def get_ai_sessions(
        user_id: str = Query(..., min_length=1),
        limit: int = Query(50, ge=1, le=200),
        linked_conversation_id: str | None = Query(default=None),
        db: Session = Depends(get_db),
        authorization: str | None = Header(default=None),
    ):
        _require_token(settings, authorization)
        rows = list_ai_sessions(
            db,
            user_id=user_id,
            limit=limit,
            linked_conversation_id=linked_conversation_id,
        )
        return [AIChatSessionSummary(**row) for row in rows]

    @app.post("/v1/ai/sessions", response_model=AIChatSessionSummary)
    def create_ai_session_api(
        request: CreateAIChatSessionRequest,
        db: Session = Depends(get_db),
        authorization: str | None = Header(default=None),
    ):
        _require_token(settings, authorization)
        row = create_ai_session(
            db,
            user_id=request.user_id,
            title=request.title,
            source=request.source,
            subject=request.subject,
            linked_classroom_id=request.linked_classroom_id,
            linked_conversation_id=request.linked_conversation_id,
        )
        db.commit()
        db.refresh(row)
        return AIChatSessionSummary(**serialize_ai_session(row))

    @app.get("/v1/ai/sessions/{session_id}/messages", response_model=list[AIChatMessageOutput])
    def get_ai_messages(
        session_id: str,
        limit: int = Query(200, ge=1, le=500),
        db: Session = Depends(get_db),
        authorization: str | None = Header(default=None),
    ):
        _require_token(settings, authorization)
        rows = list_ai_messages(db, session_id=session_id, limit=limit)
        return [AIChatMessageOutput(**row) for row in rows]

    @app.post("/v1/ai/sessions/{session_id}/messages", response_model=AIChatMessageOutput)
    def create_ai_message_api(
        session_id: str,
        request: CreateAIChatMessageRequest,
        db: Session = Depends(get_db),
        authorization: str | None = Header(default=None),
    ):
        _require_token(settings, authorization)
        row = create_ai_message(
            db,
            session_id=session_id,
            role=request.role,
            content=request.content,
            user_id=request.user_id,
            content_type=request.content_type,
            model_name=request.model_name,
            prompt_tokens=request.prompt_tokens,
            completion_tokens=request.completion_tokens,
            total_tokens=request.total_tokens,
            latency_ms=request.latency_ms,
            request_id=request.request_id,
            parent_message_id=request.parent_message_id,
        )
        db.commit()
        return AIChatMessageOutput(**serialize_ai_message(row))

    @app.post("/v1/ai/messages/{message_id}/feedback", response_model=AIMessageFeedbackOutput)
    def upsert_ai_feedback_api(
        message_id: str,
        request: AIMessageFeedbackRequest,
        db: Session = Depends(get_db),
        authorization: str | None = Header(default=None),
    ):
        _require_token(settings, authorization)
        row = upsert_ai_feedback(
            db,
            message_id=message_id,
            user_id=request.user_id,
            rating=request.rating,
            feedback_text=request.feedback_text,
        )
        db.commit()
        return AIMessageFeedbackOutput(**serialize_ai_feedback(row))

    @app.exception_handler(HTTPException)
    async def http_exception_handler(_request, exc: HTTPException):
        if isinstance(exc.detail, dict):
            return JSONResponse(status_code=exc.status_code, content=exc.detail)
        return JSONResponse(status_code=exc.status_code, content={"error_code": "HTTP_ERROR", "message": str(exc.detail)})

    @app.exception_handler(ValueError)
    async def value_error_handler(_request, exc: ValueError):
        return JSONResponse(status_code=400, content={"error_code": "INVALID_REQUEST", "message": str(exc)})

    return app


app = create_app()

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Check, Copy, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/hooks/use-i18n';
import { Textarea } from '@/components/ui/textarea';
import type { Scene } from '@/lib/types/stage';
import type { SpeechAction } from '@/lib/types/action';
import type {
  PPTElement,
  PPTLatexElement,
  PPTShapeElement,
  PPTTableElement,
  PPTTextElement,
} from '@/lib/types/slides';

const STORAGE_PREFIX = 'anotherme:classroom:editable-notes:v1';

interface LectureNotesViewProps {
  scenes: Scene[];
  currentSceneId?: string | null;
  stageId?: string | null;
}

interface KnowledgeSection {
  sceneId: string;
  title: string;
  bullets: string[];
}

interface SavedNote {
  content: string;
  sourceHash: string;
  updatedAt: number;
}

function stripHtml(value: string): string {
  if (!value) return '';

  if (typeof window === 'undefined') {
    return value
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .trim();
  }

  const parser = new window.DOMParser();
  const doc = parser.parseFromString(`<div>${value}</div>`, 'text/html');
  return doc.body.textContent?.trim() ?? '';
}

function normalizeText(value: string): string {
  return stripHtml(value)
    .replace(/\s+/g, ' ')
    .replace(/\s*([,:;!?])/g, '$1')
    .trim();
}

function countPunctuation(value: string): number {
  const matches = value.match(/[，,。！？!?；;]/g);
  return matches ? matches.length : 0;
}

function simplifyKnowledgeLine(value: string): string {
  const line = normalizeText(value);
  if (!line) return '';
  if (line.length <= 42) return line;

  const firstSentence = line.split(/[。！？!?；;]/)[0]?.trim();
  if (firstSentence && firstSentence.length >= 6 && firstSentence.length <= 42) {
    return firstSentence;
  }

  return `${line.slice(0, 40).trimEnd()}…`;
}

function isUsefulLine(value: string): boolean {
  const line = normalizeText(value);
  if (!line || line.length < 2) return false;
  if (line.length > 120) return false;
  if (countPunctuation(line) > 4) return false;
  if (/^[\d\s()./-]+$/.test(line)) return false;
  return true;
}

function dedupeLines(lines: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of lines) {
    const line = simplifyKnowledgeLine(raw);
    const key = line.toLowerCase();
    if (!isUsefulLine(line) || seen.has(key)) continue;
    seen.add(key);
    result.push(line);
  }

  return result;
}

function extractSpeechKnowledge(scene: Scene): string[] {
  const speechLines = (scene.actions ?? [])
    .filter((action): action is SpeechAction => {
      return (
        action.type === 'speech' &&
        typeof (action as { text?: unknown }).text === 'string' &&
        Boolean((action as { text?: string }).text)
      );
    })
    .flatMap((action) => action.text.split(/[\n。！？!?；;]/))
    .map(simplifyKnowledgeLine);

  return dedupeLines(speechLines).slice(0, 4);
}

function extractElementText(element: PPTElement): string[] {
  switch (element.type) {
    case 'text': {
      const text = element as PPTTextElement;
      if (
        text.textType === 'partNumber' ||
        text.textType === 'itemNumber' ||
        text.textType === 'footer'
      ) {
        return [];
      }
      return text.content.split(/\n+/).map(normalizeText).filter(Boolean);
    }
    case 'shape': {
      const shape = element as PPTShapeElement;
      return shape.text?.content ? shape.text.content.split(/\n+/).map(normalizeText).filter(Boolean) : [];
    }
    case 'table': {
      const table = element as PPTTableElement;
      return table.data
        .map((row) => row.map((cell) => normalizeText(cell.text)).filter(Boolean).join(' | '))
        .filter(Boolean);
    }
    case 'latex': {
      const latex = element as PPTLatexElement;
      return latex.latex ? [`公式：${latex.latex}`] : [];
    }
    default:
      return [];
  }
}

function extractKnowledge(scene: Scene): string[] {
  if (scene.content.type === 'slide') {
    const title = normalizeText(scene.title).toLowerCase();
    const lines = scene.content.canvas.elements
      .slice()
      .sort((a, b) => a.top - b.top || a.left - b.left)
      .flatMap(extractElementText)
      .filter((line) => normalizeText(line).toLowerCase() !== title);

    const deduped = dedupeLines(lines);
    const concise = deduped.filter(
      (line) => line.length <= 36 || /^[^\s]{1,18}[:：]/.test(line),
    );
    const selected = concise.length >= 3 ? concise : deduped.filter((line) => line.length <= 60);

    const fromSlide = selected.slice(0, 6);
    if (fromSlide.length > 0) {
      return fromSlide;
    }

    return extractSpeechKnowledge(scene);
  }

  if (scene.content.type === 'quiz') {
    const fromQuiz = dedupeLines(
      scene.content.questions.flatMap((question, index) => [
        `题目 ${index + 1}：${question.question}`,
        question.analysis ? `解析：${question.analysis}` : '',
      ]),
    ).slice(0, 5);

    if (fromQuiz.length > 0) {
      return fromQuiz;
    }

    return extractSpeechKnowledge(scene);
  }

  if (scene.content.type === 'interactive') {
    const fromInteractive = dedupeLines([
      scene.title,
      scene.content.url ? `互动页面：${scene.content.url}` : '',
      scene.content.html ? stripHtml(scene.content.html).slice(0, 120) : '',
    ]).slice(0, 4);

    if (fromInteractive.length > 0) {
      return fromInteractive;
    }

    return extractSpeechKnowledge(scene);
  }

  if (scene.content.type === 'pbl') {
    const fromPbl = dedupeLines([
      scene.content.projectConfig.projectInfo.title,
      scene.content.projectConfig.projectInfo.description,
      ...scene.content.projectConfig.issueboard.issues
        .slice(0, 3)
        .map((issue, index) => `任务 ${index + 1}：${issue.title}`),
    ]).slice(0, 5);

    if (fromPbl.length > 0) {
      return fromPbl;
    }

    return extractSpeechKnowledge(scene);
  }

  return extractSpeechKnowledge(scene);
}

function buildKnowledgeSections(scenes: Scene[]): KnowledgeSection[] {
  return scenes
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((scene) => ({
      sceneId: scene.id,
      title: scene.title,
      bullets: extractKnowledge(scene),
    }))
    .filter((section) => section.bullets.length > 0);
}

function buildInitialNote(sections: KnowledgeSection[]): string {
  if (!sections.length) return '';

  const lines = ['本次课堂知识点', ''];
  sections.forEach((section, index) => {
    lines.push(`${index + 1}. ${section.title}`);
    section.bullets.forEach((bullet) => lines.push(`- ${bullet}`));
    lines.push('');
  });
  return lines.join('\n').trim();
}

export function LectureNotesView({ scenes, currentSceneId, stageId }: LectureNotesViewProps) {
  const { t } = useI18n();
  const [content, setContent] = useState('');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [copied, setCopied] = useState(false);
  const referenceRef = useRef<HTMLDivElement>(null);

  const knowledgeSections = useMemo(() => buildKnowledgeSections(scenes), [scenes]);
  const initialNote = useMemo(() => buildInitialNote(knowledgeSections), [knowledgeSections]);
  const storageKey = useMemo(
    () => (stageId ? `${STORAGE_PREFIX}:${stageId}` : null),
    [stageId],
  );
  const sourceHash = useMemo(
    () =>
      knowledgeSections
        .map((section) => `${section.sceneId}:${section.title}:${section.bullets.join('|')}`)
        .join('||'),
    [knowledgeSections],
  );

  useEffect(() => {
    if (!currentSceneId || !referenceRef.current) return;
    const el = referenceRef.current.querySelector(`[data-scene-id="${currentSceneId}"]`);
    if (el instanceof HTMLElement) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [currentSceneId]);

  useEffect(() => {
    const nextContent = (() => {
      if (!storageKey) {
        return initialNote;
      }

      try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) {
          return initialNote;
        }

        const parsed = JSON.parse(raw) as SavedNote;
        return parsed.sourceHash === sourceHash ? parsed.content : initialNote;
      } catch {
        return initialNote;
      }
    })();

    const timer = window.setTimeout(() => {
      setContent(nextContent);
      setSaveState('saved');
    }, 0);

    return () => window.clearTimeout(timer);
  }, [initialNote, sourceHash, storageKey]);

  useEffect(() => {
    if (!storageKey) {
      return;
    }

    if (saveState !== 'saving') return;

    const timer = window.setTimeout(() => {
      const payload: SavedNote = {
        content,
        sourceHash,
        updatedAt: Date.now(),
      };
      try {
        localStorage.setItem(storageKey, JSON.stringify(payload));
        setSaveState('saved');
      } catch {
        setSaveState('idle');
      }
    }, 200);

    return () => window.clearTimeout(timer);
  }, [content, saveState, sourceHash, storageKey]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1200);
    return () => window.clearTimeout(timer);
  }, [copied]);

  if (knowledgeSections.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-6">
        <div className="w-12 h-12 bg-purple-50 dark:bg-purple-900/20 rounded-2xl flex items-center justify-center mb-3 text-purple-300 dark:text-purple-600 ring-1 ring-purple-100 dark:ring-purple-800/30">
          <BookOpen className="w-6 h-6" />
        </div>
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
          {t('chat.lectureNotes.empty')}
        </p>
        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
          {t('chat.lectureNotes.emptyHint')}
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-2 scrollbar-hide">
      <div className="mb-3 rounded-xl border border-purple-100/80 bg-purple-50/60 px-3 py-2 dark:border-purple-900/40 dark:bg-purple-950/20">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold text-purple-700 dark:text-purple-300">
              {t('chat.lectureNotes.editorTitle')}
            </p>
            <p className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">
              {saveState === 'saving'
                ? t('chat.lectureNotes.saving')
                : t('chat.lectureNotes.saved')}
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                setContent(initialNote);
                setSaveState('saving');
              }}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 text-[11px] font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {t('chat.lectureNotes.restore')}
            </button>
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(content);
                  setCopied(true);
                } catch {
                  setCopied(false);
                }
              }}
              className="inline-flex h-8 items-center gap-1 rounded-lg bg-purple-600 px-2.5 text-[11px] font-medium text-white transition-colors hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-400"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? t('chat.lectureNotes.copied') : t('chat.lectureNotes.copy')}
            </button>
          </div>
        </div>
      </div>

      <div className="mb-3 rounded-xl border border-gray-200/80 bg-white/80 p-2.5 dark:border-gray-800 dark:bg-gray-900/60">
        <Textarea
          value={content}
          onChange={(event) => {
            setContent(event.target.value);
            setSaveState('saving');
          }}
          placeholder={t('chat.lectureNotes.editorPlaceholder')}
          className="min-h-[260px] resize-none border-0 bg-transparent p-1 text-[12px] leading-6 shadow-none focus-visible:ring-0"
        />
      </div>

      <div
        ref={referenceRef}
        className="rounded-xl border border-gray-200/80 bg-gray-50/60 px-3 py-2 dark:border-gray-800 dark:bg-gray-900/40"
      >
        <div className="mb-2">
          <p className="text-[11px] font-semibold text-gray-700 dark:text-gray-200">
            {t('chat.lectureNotes.referenceTitle')}
          </p>
          <p className="mt-0.5 text-[10px] text-gray-500 dark:text-gray-400">
            {t('chat.lectureNotes.referenceHint')}
          </p>
        </div>

        <div className="space-y-2">
          {knowledgeSections.map((section, index) => {
            const isCurrent = section.sceneId === currentSceneId;

            return (
              <div
                key={section.sceneId}
                data-scene-id={section.sceneId}
                className={cn(
                  'rounded-lg px-3 py-2 transition-colors duration-200',
                  isCurrent
                    ? 'bg-purple-50/80 ring-1 ring-purple-200/60 dark:bg-purple-950/25 dark:ring-purple-700/30'
                    : 'bg-white/80 dark:bg-gray-800/30',
                )}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <div
                    className={cn(
                      'w-2 h-2 rounded-full shrink-0',
                      isCurrent
                        ? 'bg-purple-500 dark:bg-purple-400'
                        : 'bg-gray-300 dark:bg-gray-600',
                    )}
                  />
                  <span className="text-[10px] font-semibold tracking-wide text-gray-400 dark:text-gray-500">
                    {t('chat.lectureNotes.pageLabel', { n: index + 1 })}
                  </span>
                  {isCurrent && (
                    <span className="text-[9px] font-bold px-1.5 py-px rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300">
                      {t('chat.lectureNotes.currentPage')}
                    </span>
                  )}
                </div>

                <h4 className="text-[13px] font-bold text-gray-800 dark:text-gray-100 mb-1.5 pl-4">
                  {section.title}
                </h4>

                <div className="pl-4 space-y-1">
                  {section.bullets.map((bullet) => (
                    <p
                      key={`${section.sceneId}-${bullet}`}
                      className="text-[12px] leading-[1.8] text-gray-700 dark:text-gray-300"
                    >
                      • {bullet}
                    </p>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

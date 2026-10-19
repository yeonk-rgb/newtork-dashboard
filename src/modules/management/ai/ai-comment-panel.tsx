"use client";
// AI 분석 코멘트 내용 + [분석하기]/[다시 분석] 버튼 (생성 중 표시, 실패 안내·재시도)
import { Loader2, Sparkles, TriangleAlert } from "lucide-react";
import { useState, useTransition } from "react";

import { cn } from "@/shared/lib/utils";

import { generateAiComment, type AiActionResult } from "./actions";
import type { AiCommentView } from "./load-comment";

type Failure = Extract<AiActionResult, { ok: false }>;

export function AiCommentPanel({
  view,
  basisNote,
}: {
  view: AiCommentView;
  /** 연간·누적·월 보기일 때 "어느 분기를 보여주는지" 안내 */
  basisNote: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [failure, setFailure] = useState<Failure | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const { latest, abilities, isStale } = view;

  const generate = () => {
    setFailure(null);
    setDone(null);
    startTransition(async () => {
      const result = await generateAiComment({
        year: view.year,
        quarter: view.quarter,
        expectedLatestId: latest?.id ?? null,
      });
      if (result.ok) setDone(result.message);
      else setFailure(result);
    });
  };

  return (
    <div className="flex flex-1 flex-col gap-3 text-sm" aria-busy={pending}>
      {basisNote && (
        <p className="text-xs text-muted-foreground">{basisNote}</p>
      )}

      {isStale && !pending && (
        <p className="flex items-start gap-1.5 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
          <span>
            데이터가 변경되어 분석이 최신이 아닙니다.{" "}
            {abilities.canGenerate
              ? "[다시 분석]을 누르면 지금 데이터로 다시 분석합니다."
              : "팀장이 다시 분석하면 갱신됩니다."}
          </span>
        </p>
      )}

      {pending && (
        <p
          role="status"
          className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-xs"
        >
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
          AI가 분석 중입니다. 1분 정도 걸릴 수 있습니다.
        </p>
      )}

      {failure && !pending && (
        <div
          role="alert"
          className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive"
        >
          {failure.message}
          {failure.retryable && (
            <button
              type="button"
              onClick={generate}
              className="ml-2 font-medium underline"
            >
              다시 시도
            </button>
          )}
        </div>
      )}
      {done && !pending && (
        <p role="status" className="text-xs text-muted-foreground">
          {done}
        </p>
      )}

      {latest ? (
        <div className={cn("space-y-3", pending && "opacity-50")}>
          <section>
            <h3 className="mb-1 text-xs font-semibold text-muted-foreground">
              매출 현황
            </h3>
            <p className="leading-relaxed">{latest.result.summary}</p>
          </section>
          <CommentList title="부족한 점" items={latest.result.weaknesses} />
          <CommentList
            title="다음 분기 개선 제안"
            items={latest.result.improvements}
          />
        </div>
      ) : (
        !pending && (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 py-6 text-center text-muted-foreground">
            <Sparkles className="size-6" aria-hidden />
            <p>
              {abilities.notice ??
                (abilities.canGenerate
                  ? "[분석하기]를 누르면 이 분기의 매출 현황·부족한 점·개선 제안을 정리합니다."
                  : "아직 분석이 없습니다. 팀장이 [분석하기]로 생성합니다.")}
            </p>
          </div>
        )
      )}

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t pt-2">
        <p className="text-xs text-muted-foreground">
          {latest ? (
            <>
              AI가 생성한 참고용 분석입니다 · {latest.createdAtLabel} 생성
              {latest.isMock && " · 모의 응답"}
            </>
          ) : (
            "AI가 생성한 참고용 분석을 보여줍니다"
          )}
          {latest && abilities.notice && (
            <span className="block">{abilities.notice}</span>
          )}
        </p>
        {abilities.canGenerate && (
          <button
            type="button"
            onClick={generate}
            disabled={pending}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {pending ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="size-3.5" aria-hidden />
            )}
            {pending ? "분석 중…" : latest ? "다시 분석" : "분석하기"}
          </button>
        )}
      </div>
    </div>
  );
}

function CommentList({ title, items }: { title: string; items: string[] }) {
  return (
    <section>
      <h3 className="mb-1 text-xs font-semibold text-muted-foreground">
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="text-muted-foreground">없음</p>
      ) : (
        <ul className="list-disc space-y-1 pl-4 leading-relaxed">
          {items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

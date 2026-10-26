"use client";
// AI 분석 카드 (생성 중 표시, 실패 안내·재시도 포함)
// 제목·생성 정보·[다시 분석] → 굵은 headline → 3단(이번 기간 현황 / 부족한 점·주의 / 다음 분기 개선할 점)
import { Loader2, Sparkles, TriangleAlert } from "lucide-react";
import { useState, useTransition } from "react";

import { cn } from "@/shared/lib/utils";

import { AiCardColumn, AiCardFrame } from "./ai-card-frame";
import { generateAiComment, type AiActionResult } from "./actions";
import type { AiCommentMethod, AiCommentView } from "./load-comment";
import { buttonPrimaryClass } from "@/shared/ui/styles";

type Failure = Extract<AiActionResult, { ok: false }>;

const METHOD_LABEL: Record<AiCommentMethod, string> = {
  ai: "AI 분석",
  mock: "모의 응답",
  example: "예시",
};

export function AiCommentPanel({
  title,
  view,
  basisNote,
}: {
  title: string;
  view: AiCommentView;
  /** 연간·누적·월 보기일 때 "어느 분기를 보여주는지" 안내 */
  basisNote: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [failure, setFailure] = useState<Failure | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const { latest, abilities, staleReason } = view;

  const generate = () => {
    setFailure(null);
    setDone(null);
    startTransition(async () => {
      const result = await generateAiComment({
        year: view.year,
        quarter: view.quarter,
        expectedLatestId: view.latestId,
      });
      if (result.ok) setDone(result.message);
      else setFailure(result);
    });
  };

  const button = abilities.canGenerate && (
    <button
      type="button"
      onClick={generate}
      disabled={pending}
      className={buttonPrimaryClass}
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : (
        <Sparkles className="size-4" aria-hidden />
      )}
      {pending ? "분석 중…" : latest ? "다시 분석" : "분석하기"}
    </button>
  );

  // 생성 방식: "AI 분석" / "모의 응답" / "예시"
  const meta = latest
    ? `${METHOD_LABEL[latest.method]} · ${latest.createdAtLabel}`
    : undefined;

  return (
    <AiCardFrame title={title} meta={meta} action={button}>
      <div className="flex flex-1 flex-col gap-3 text-sm" aria-busy={pending}>
        {basisNote && (
          <p className="-mt-2 text-xs text-muted-foreground">{basisNote}</p>
        )}

        {staleReason && !pending && (
          <p className="flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning-strong">
            <TriangleAlert className="mt-px size-4 shrink-0" aria-hidden />
            <span>
              {staleReason === "prompt"
                ? "분석 기준이 바뀌어 이전 기준으로 만든 분석입니다."
                : "데이터가 변경되어 분석이 최신이 아닙니다."}{" "}
              {abilities.canGenerate
                ? "[다시 분석]을 누르면 지금 데이터로 다시 분석합니다."
                : "팀장이 다시 분석하면 갱신됩니다."}
            </span>
          </p>
        )}

        {pending && (
          <p
            role="status"
            className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-xs"
          >
            <Loader2 className="size-4 animate-spin" aria-hidden />
            AI가 분석 중입니다. 1분 정도 걸릴 수 있습니다.
          </p>
        )}

        {failure && !pending && (
          <div
            role="alert"
            className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger-strong"
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
            {latest.result.headline && (
              <p className="text-base font-semibold">
                {latest.result.headline}
              </p>
            )}
            {/* 넓은 화면에서 3단 */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <AiCardColumn
                dotClass="bg-foreground"
                title="이번 기간 현황"
                items={latest.result.summary}
              />
              <AiCardColumn
                dotClass="bg-destructive"
                title="부족한 점·주의"
                items={latest.result.shortfalls}
              />
              <AiCardColumn
                dotClass="bg-primary"
                title="다음 분기 개선할 점"
                items={latest.result.improvements}
                extra={
                  latest.result.longOverdue &&
                  latest.result.longOverdue.length > 0 && (
                    <li className="flex gap-2 text-muted-foreground">
                      <span aria-hidden>•</span>
                      <span>
                        장기 미수금 거래처:{" "}
                        {latest.result.longOverdue
                          .map((c) =>
                            c.ageDays === undefined
                              ? `${c.name}(${c.amount})`
                              : `${c.name}(${c.amount}·${c.ageDays}일)`,
                          )
                          .join(", ")}
                      </span>
                    </li>
                  )
                }
              />
            </div>
          </div>
        ) : (
          !pending && (
            <div className="flex flex-col items-center justify-center gap-2 py-6 text-center text-muted-foreground">
              <Sparkles className="size-5" aria-hidden />
              <p>
                {abilities.notice ??
                  (abilities.canGenerate
                    ? "[분석하기]를 누르면 이 분기의 현황·부족한 점·개선할 점을 정리합니다."
                    : "아직 분석이 없습니다. 팀장이 [분석하기]로 생성합니다.")}
              </p>
            </div>
          )
        )}

        <p className="border-t pt-2 text-xs text-muted-foreground">
          {latest?.method === "example"
            ? "시드 데이터로 만든 예시 분석입니다. [다시 분석]을 누르면 새 분석으로 바뀝니다"
            : "AI가 생성한 참고용 분석입니다"}
          {latest?.result.legacy && " · 이전 형식"}
          {latest && abilities.notice && (
            <span className="block">{abilities.notice}</span>
          )}
        </p>
      </div>
    </AiCardFrame>
  );
}

// 연간 목표 도넛 (meter): 선택한 연도의 연간 목표 대비 확정 누적 실적.
// 기간 토글과 무관하게 연도 기준 유지. 도넛 위 얇은 눈금 = 연간 경과율(진도 기준선).
import { METER } from "@/shared/ui/chart-colors";
import { Won } from "@/shared/ui/won";

import type { AnnualProgress } from "../../metrics/types";
import { monthsText } from "../confirmation-text";
import { ChartCard } from "./chart-card";

const SIZE = 200;
const CENTER = SIZE / 2;
const RADIUS = 78;
const STROKE = 18;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

/** 12시 방향에서 시계 방향으로 ratio 만큼 간 점 */
function pointAt(ratio: number, r: number) {
  const angle = ratio * 2 * Math.PI - Math.PI / 2;
  return { x: CENTER + r * Math.cos(angle), y: CENTER + r * Math.sin(angle) };
}

export function TargetDonut({
  year,
  progress,
}: {
  year: number;
  progress: AnnualProgress | null;
}) {
  const title = `${year}년 연간 목표 달성률`;
  if (!progress) {
    return (
      <ChartCard title={title}>
        <p className="py-16 text-center text-sm text-muted-foreground">
          {year}년 목표가 설정되지 않았습니다. (목표 설정은 6단계)
        </p>
      </ChartCard>
    );
  }

  const rate = progress.rate ?? 0;
  const filled = Math.min(rate, 1);
  const gap = rate - progress.elapsedRatio; // + 앞섬 / − 뒤처짐
  const showMarker = progress.elapsedRatio > 0 && progress.elapsedRatio < 1;
  const inner = pointAt(progress.elapsedRatio, RADIUS - STROKE / 2 - 5);
  const outer = pointAt(progress.elapsedRatio, RADIUS + STROKE / 2 + 5);
  const confirmedText = monthsText(
    progress.confirmedMonths.map((month) => ({ year, month })),
  );

  return (
    <ChartCard title={title}>
      <figure className="flex flex-col items-center">
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="w-44"
          role="img"
          aria-label={`${title} ${pct(rate)}, 연간 경과율 ${pct(progress.elapsedRatio)}`}
        >
          <circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            fill="none"
            stroke={METER.track}
            strokeWidth={STROKE}
          />
          {filled > 0 && (
            <circle
              cx={CENTER}
              cy={CENTER}
              r={RADIUS}
              fill="none"
              stroke={METER.fill}
              strokeWidth={STROKE}
              strokeLinecap={filled < 1 ? "round" : "butt"}
              strokeDasharray={`${filled * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
              transform={`rotate(-90 ${CENTER} ${CENTER})`}
            />
          )}
          {showMarker && (
            <line
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              className="stroke-foreground"
              strokeWidth={2}
            />
          )}
          <text
            x={CENTER}
            y={CENTER + 4}
            textAnchor="middle"
            className="fill-foreground text-[30px] font-semibold"
          >
            {pct(rate)}
          </text>
          <text
            x={CENTER}
            y={CENTER + 26}
            textAnchor="middle"
            className="fill-muted-foreground text-[11px]"
          >
            연간 달성률
          </text>
        </svg>

        <figcaption className="mt-2 w-full space-y-1 text-sm">
          <dl className="grid grid-cols-3 gap-2 text-center">
            <div>
              <dt className="text-xs text-muted-foreground">연간 목표</dt>
              <dd className="font-medium">
                <Won value={progress.target} />
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">누적 실적</dt>
              <dd className="font-medium">
                <Won value={progress.actual} />
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">남은 금액</dt>
              <dd className="font-medium">
                <Won value={progress.remaining} />
              </dd>
            </div>
          </dl>
          <p className="pt-2 text-center text-xs text-muted-foreground">
            <span
              aria-hidden
              className="mr-1 inline-block h-3 w-0.5 bg-foreground align-middle"
            />
            연간 경과율 {pct(progress.elapsedRatio)} (
            {progress.elapsedMonths > 0
              ? `${progress.elapsedMonths}월까지 마감`
              : "아직 시작 전"}
            )
            {progress.elapsedRatio > 0 && (
              <>
                {" · "}
                <span className="font-medium text-foreground">
                  진도 대비 {gap >= 0 ? "▲" : "▼"}
                  {Math.abs(gap * 100).toFixed(1)}%p{" "}
                  {gap >= 0 ? "앞섬" : "뒤처짐"}
                </span>
              </>
            )}
          </p>
          <p className="text-center text-xs text-muted-foreground">
            실적은 확정된 달만 ({confirmedText || "확정 월 없음"})
          </p>
        </figcaption>
      </figure>
    </ChartCard>
  );
}

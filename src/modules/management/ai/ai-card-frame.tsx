// AI 분석 카드 틀 (서버·클라이언트 공용, 상태 없음): 연한 네이비 바탕(primary-50) + 왼쪽 네이비 강조선 + 제목 / 오른쪽 위 생성 정보·버튼
export function AiCardFrame({
  title,
  meta,
  action,
  children,
}: {
  /** "AI 분석 코멘트 · 2024년 4분기" */
  title: string;
  /** "AI 분석 · 2026-10-19 14:13:35" */
  meta?: React.ReactNode;
  /** [분석하기]/[다시 분석] */
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-label="AI 분석 코멘트"
      className="flex flex-col rounded-card border border-l-4 border-primary/15 border-l-primary bg-brand-soft/60 p-5"
    >
      <header className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <h2 className="text-[15px] font-semibold">{title}</h2>
        {(meta || action) && (
          <div className="flex flex-wrap items-center gap-2">
            {meta && (
              <span className="text-xs text-muted-foreground tabular-nums">
                {meta}
              </span>
            )}
            {action}
          </div>
        )}
      </header>
      {children}
    </section>
  );
}

/** 3단 칸: 제목 앞 색 점 + • 글머리 목록 */
export function AiCardColumn({
  dotClass,
  title,
  items,
  empty = "없음",
  extra,
}: {
  dotClass: string;
  title: string;
  items: string[];
  empty?: string;
  /** 목록 뒤에 덧붙일 항목 (서버가 붙이는 장기 미수 거래처 등) */
  extra?: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold">
        <span className={`size-2 rounded-full ${dotClass}`} aria-hidden />
        {title}
      </h3>
      {items.length === 0 && !extra ? (
        <p className="text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-1 leading-relaxed">
          {items.map((item, i) => (
            <li key={i} className="flex gap-1.5">
              <span aria-hidden className="text-muted-foreground">
                •
              </span>
              <span>{item}</span>
            </li>
          ))}
          {extra}
        </ul>
      )}
    </section>
  );
}

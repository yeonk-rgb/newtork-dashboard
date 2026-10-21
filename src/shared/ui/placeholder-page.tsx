import { Construction } from "lucide-react";
import { pageTitleClass } from "@/shared/ui/styles";

/** 기능 구현 전 화면 자리표시. 예: <PlaceholderPage title="경영지원팀" /> → "경영지원팀 - 준비 중" */
export function PlaceholderPage({ title }: { title: string }) {
  return (
    <section className="flex items-center gap-4 rounded-card border bg-card p-6">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
        <Construction className="size-5 text-muted-foreground" aria-hidden />
      </span>
      <h1 className={pageTitleClass}>{title} - 준비 중</h1>
    </section>
  );
}

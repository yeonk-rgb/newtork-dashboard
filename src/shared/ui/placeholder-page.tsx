/** 기능 구현 전 화면 자리표시. 예: <PlaceholderPage title="경영지원팀" /> → "경영지원팀 - 준비 중" */
export function PlaceholderPage({ title }: { title: string }) {
  return <h1 className="text-xl font-semibold">{title} - 준비 중</h1>;
}

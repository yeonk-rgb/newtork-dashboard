// AI 입력용 문구 (순수 함수): AI 가 직접 빼기·반올림하지 않도록 차이를 미리 계산해 문장으로 만든다
// 표시값(소수 첫째 자리)끼리 계산해 "82.4%로 17.6%p 부족"처럼 숫자가 서로 맞게 한다

/** 비율(0~1+) → 0.1%p 단위 정수 (0.8235 → 824) */
const tenths = (ratio: number) => Math.round(ratio * 1000);
const fmt = (t: number) => (t / 10).toFixed(1);

/** 목표 대비 달성률: "82.4%로 17.6%p 부족" / "105.2%로 5.2%p 초과" / "100.0%로 목표 달성" */
export function achievementText(rate: number): string {
  const t = tenths(rate);
  const diff = t - 1000;
  if (diff === 0) return `${fmt(t)}%로 목표 달성`;
  return `${fmt(t)}%로 ${fmt(Math.abs(diff))}%p ${diff < 0 ? "부족" : "초과"}`;
}

/** 연간 진도: "연간 달성률 60.0%로 경과율 75.0% 대비 15.0%p 뒤처짐" (앞섬 / 경과율과 같음) */
export function progressText(rate: number, elapsedRatio: number): string {
  const t = tenths(rate);
  const e = tenths(elapsedRatio);
  const head = `연간 달성률 ${fmt(t)}%로 경과율 ${fmt(e)}%`;
  const diff = t - e;
  if (diff === 0) return `${head}와 같음`;
  return `${head} 대비 ${fmt(Math.abs(diff))}%p ${diff < 0 ? "뒤처짐" : "앞섬"}`;
}

// 회사 로고 (docs/design-guide.md "로고")
// 원본(newtork-logo-original.png)은 세로형(심볼 위·워드마크 아래)이라 작은 높이에서 워드마크가 읽히지 않아,
// 원본에서 심볼·워드마크를 각각 그대로 잘라(색·비율 그대로, 흰 바탕) 가로로 나란히 놓는다.
// 재채색·늘리기·그림자·테두리 금지. 공식 가로형·SVG 를 받으면 이 파일의 이미지만 바꾼다 (05-open-questions)
// unoptimized: 이미지 최적화(WebP 재압축)를 거치지 않고 원본 PNG 픽셀을 그대로 보낸다 (색 변형 방지). 원본 해상도는 표시 크기의 2배 이상: 심볼 204px(최대 48px 표시, 4.25배)·워드마크 64px(최대 20px, 3.2배)
import Image from "next/image";

import { cn } from "@/shared/lib/utils";

import symbol from "./newtork-symbol.png";
import wordmark from "./newtork-wordmark.png";

/** 높이(px): 심볼 / 워드마크 / 둘 사이 간격. 주변 여백은 심볼 높이의 50% 이상 (쓰는 쪽에서 확보) */
const SIZES = {
  /** 헤더·403 */
  md: { symbol: 32, word: 14, gap: 12 },
  /** 로그인·비밀번호 변경 카드 */
  lg: { symbol: 48, word: 20, gap: 16 },
} as const;

const widthFor = (img: { width: number; height: number }, h: number) =>
  Math.round((img.width * h) / img.height);

export function Logo({
  size = "md",
  className,
}: {
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const s = SIZES[size];
  return (
    <span
      className={cn("inline-flex shrink-0 items-center", className)}
      style={{ gap: s.gap }}
    >
      <Image
        src={symbol}
        alt="뉴토크코리아"
        width={widthFor(symbol, s.symbol)}
        height={s.symbol}
        loading="eager"
        unoptimized
      />
      {/* 워드마크는 같은 회사명이라 스크린 리더에는 한 번만 읽힌다 */}
      <Image
        src={wordmark}
        alt=""
        width={widthFor(wordmark, s.word)}
        height={s.word}
        loading="eager"
        unoptimized
      />
    </span>
  );
}

// 지도 투영 (순수 함수) — 경계 경로(scripts/make-korea-map.ts)와 버블 위치가 같은 식을 쓴다
export const MAP_FRAME = { width: 560, height: 620, pad: 12 } as const;

/** 메르카토르 [x, y] (라디안 단위) */
export function mercator(lon: number, lat: number): [number, number] {
  const rad = Math.PI / 180;
  return [lon * rad, Math.log(Math.tan(Math.PI / 4 + (lat * rad) / 2))];
}

export type MapFit = { minX: number; maxY: number; k: number };

/** 위도·경도 → 지도 SVG 좌표 */
export function project(fit: MapFit, lon: number, lat: number) {
  const [x, y] = mercator(lon, lat);
  return {
    x: MAP_FRAME.pad + (x - fit.minX) * fit.k,
    y: MAP_FRAME.pad + (fit.maxY - y) * fit.k,
  };
}

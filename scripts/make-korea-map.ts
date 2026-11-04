// 서비스 대시보드 지도용 시·도 경계 SVG 경로 만들기 (실행할 때만 — 결과 JSON 을 저장소에 넣는다)
// 원본: scripts/data/sido.topo.json — 친구 저장소 frontend/public/geo 와 같은 파일
//   통계청 SGIS 행정동 경계(공공누리 제1유형) 가공 vuski/admdongkor ver20261001 (CC BY 4.0)
// 투영: 메르카토르 (친구 앱 chartjs-chart-geo projection: 'mercator' 와 같음) — 버블 위치는 같은 식(dashboard/projection.ts project())
// 실행: npx tsx scripts/make-korea-map.ts
import { readFileSync, writeFileSync } from "node:fs";

import {
  MAP_FRAME,
  mercator,
} from "../src/modules/service/dashboard/projection";

type Topo = {
  arcs: [number, number][][];
  transform: { scale: [number, number]; translate: [number, number] };
  objects: Record<
    string,
    {
      geometries: {
        type: string;
        arcs: number[][] | number[][][];
        properties: { name: string };
      }[];
    }
  >;
};

const topo = JSON.parse(
  readFileSync(new URL("./data/sido.topo.json", import.meta.url), "utf8"),
) as Topo;
const { scale, translate } = topo.transform;

// 양자화·델타 인코딩된 arc → [경도, 위도] 목록
const arcs = topo.arcs.map((arc) => {
  let x = 0;
  let y = 0;
  return arc.map(([dx, dy]) => {
    x += dx;
    y += dy;
    return [x * scale[0] + translate[0], y * scale[1] + translate[1]] as const;
  });
});
const ring = (indexes: number[]) => {
  const pts: (readonly [number, number])[] = [];
  for (const i of indexes) {
    const a = i < 0 ? [...arcs[~i]].reverse() : arcs[i];
    pts.push(...(pts.length ? a.slice(1) : a));
  }
  return pts;
};

const geometries = Object.values(topo.objects)[0].geometries;
const all = geometries.flatMap((g) =>
  (g.type === "Polygon"
    ? [g.arcs as number[][]]
    : (g.arcs as number[][][])
  ).flatMap((poly) => poly.map(ring)),
);
const projected = all.flat().map(([lon, lat]) => mercator(lon, lat));
const bounds = {
  minX: Math.min(...projected.map((p) => p[0])),
  maxX: Math.max(...projected.map((p) => p[0])),
  minY: Math.min(...projected.map((p) => p[1])),
  maxY: Math.max(...projected.map((p) => p[1])),
};
const k = Math.min(
  (MAP_FRAME.width - MAP_FRAME.pad * 2) / (bounds.maxX - bounds.minX),
  (MAP_FRAME.height - MAP_FRAME.pad * 2) / (bounds.maxY - bounds.minY),
);
const fit = { ...bounds, k };
const toXY = (lon: number, lat: number) => {
  const [x, y] = mercator(lon, lat);
  return [
    MAP_FRAME.pad + (x - bounds.minX) * k,
    MAP_FRAME.pad + (bounds.maxY - y) * k,
  ];
};
const paths = geometries.map((g) => ({
  name: g.properties.name,
  d: (g.type === "Polygon" ? [g.arcs as number[][]] : (g.arcs as number[][][]))
    .flatMap((poly) =>
      poly.map(
        (r) =>
          "M" +
          ring(r)
            .map(([lon, lat]) =>
              toXY(lon, lat)
                .map((v) => v.toFixed(1))
                .join(","),
            )
            .join("L") +
          "Z",
      ),
    )
    .join(""),
}));
writeFileSync(
  new URL("../src/modules/service/dashboard/korea-map.json", import.meta.url),
  JSON.stringify({ fit, paths }) + "\n",
);
console.log(`시·도 ${paths.length}개, ${JSON.stringify(fit)}`);

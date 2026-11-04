// 배포 서버 확인 (로그인 없이) — /api/health 200, 생산·서비스·부품 화면 13개가 모두 로그인 화면으로 넘어가는지(404·500 없음)
// 실행: npm run check:deployed -- https://newtork-dashboard.onrender.com
//       npm run check:deployed -- http://localhost:3000
// 무료 Render 는 잠들어 있으면 첫 요청이 30초~1분 걸린다 — 첫 요청은 90초까지 기다린다
const PAGES = [
  "/production",
  "/production/records",
  "/production/search",
  "/production/calendar",
  "/production/upload",
  "/production/categories",
  "/service",
  "/service/reports",
  "/service/parts",
  "/service/sites",
  "/service/prices",
  "/service/prices/by-site",
  "/service/prices/compare",
];

async function get(url: string, timeoutMs: number) {
  const started = Date.now();
  const res = await fetch(url, {
    redirect: "manual",
    signal: AbortSignal.timeout(timeoutMs),
  });
  return { res, ms: Date.now() - started };
}

async function main() {
  const base = (process.argv[2] ?? "").replace(/\/+$/, "");
  if (!/^https?:\/\//.test(base)) {
    throw new Error(
      "배포 주소를 넣으세요: npm run check:deployed -- https://…onrender.com",
    );
  }
  let failed = 0;
  const line = (ok: boolean, text: string) => {
    if (!ok) failed++;
    console.log(`${ok ? "✓" : "✗"} ${text}`);
  };

  const health = await get(`${base}/api/health`, 90_000);
  const body = await health.res.text();
  line(
    health.res.status === 200 && body.includes('"ok"'),
    `/api/health ${health.res.status} ${body.trim()} (${health.ms}ms)`,
  );

  for (const path of PAGES) {
    const { res, ms } = await get(`${base}${path}`, 30_000);
    const location = res.headers.get("location") ?? "";
    const toLogin =
      res.status >= 300 &&
      res.status < 400 &&
      /\/login(\?|$)/.test(
        new URL(location, base).pathname + new URL(location, base).search,
      );
    line(
      toLogin,
      `${path.padEnd(26)} ${res.status} → ${location || "(이동 없음)"} (${ms}ms)`,
    );
  }

  const login = await get(`${base}/login`, 30_000);
  line(
    login.res.status === 200,
    `/login ${login.res.status} (로그인 화면이 열림)`,
  );

  console.log(
    failed ? `\n${failed}개 실패` : `\n모두 통과 (${PAGES.length + 2}개)`,
  );
  if (failed) process.exitCode = 1;
}

main().catch((e) => {
  console.error((e as Error).message);
  process.exitCode = 1;
});

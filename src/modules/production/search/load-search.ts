// 일련번호 검색 조회 (서버 전용) — 친구 저장소 SerialSearchView 의 두 조회(serial_exact·serial) 그대로, 숨긴 행 제외
import "server-only";

import { loadRecordList } from "../records/load-records";

/** 비슷한 일련번호 목록 최대 행 수 (친구 앱 쪽 크기와 같음) */
export const SIMILAR_LIMIT = 50;

/** 정확히 같은 일련번호(시트가 다르면 여러 건) + 일부가 같은 일련번호 */
export async function searchSerial(q: string) {
  const [exact, similar] = await Promise.all([
    loadRecordList({ deletedAt: null, serialNo: q }, { take: 100 }),
    loadRecordList(
      {
        deletedAt: null,
        serialNo: { contains: q, mode: "insensitive" },
      },
      { take: SIMILAR_LIMIT },
    ),
  ]);
  return { exact: exact.rows, similar };
}

/** 목록에서 고른 1건 + 같은 일련번호 건수 안내용 목록. 숨겼거나 없으면 null */
export async function loadSerialDetail(id: string) {
  const { rows } = await loadRecordList({ deletedAt: null, id }, { take: 1 });
  const detail = rows[0];
  if (!detail) return null;
  const exact = await loadRecordList(
    { deletedAt: null, serialNo: detail.serialNo },
    { take: 100 },
  );
  return { detail, exact: exact.rows };
}

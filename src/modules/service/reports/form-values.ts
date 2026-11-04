// 출장보고서 입력 폼 값 모양·빈 값 (서버 화면·클라이언트 폼 공용 — "use client" 파일의 함수는 서버에서 부를 수 없음)
export type FormValues = {
  title: string;
  status: string;
  requestOrgType: string;
  requestOrg: string;
  siteContact: string;
  address: string;
  region: string;
  sigungu: string;
  tripStart: string;
  tripEnd: string;
  extraTrip: string;
  authorName: string;
  writtenAt: string;
  happyCallDate: string;
  workType: string;
  faultDescription: string;
  workDescription: string;
  workResult: string;
  billing: string;
  quoteType: string;
  quote: string;
  approver: string;
  cc: string;
  note: string;
  companions: string[];
  products: {
    modelName: string;
    spec: string;
    serialNo: string;
    quantity: string;
  }[];
  parts: { name: string; quantity: string }[];
};

export const emptyProduct = () => ({
  modelName: "",
  spec: "",
  serialNo: "",
  quantity: "",
});
export const emptyForm = (): FormValues => ({
  title: "",
  status: "",
  requestOrgType: "",
  requestOrg: "",
  siteContact: "",
  address: "",
  region: "",
  sigungu: "",
  tripStart: "",
  tripEnd: "",
  extraTrip: "",
  authorName: "",
  writtenAt: "",
  happyCallDate: "",
  workType: "",
  faultDescription: "",
  workDescription: "",
  workResult: "",
  billing: "",
  quoteType: "",
  quote: "",
  approver: "",
  cc: "",
  note: "",
  companions: [],
  products: [emptyProduct()],
  parts: [],
});

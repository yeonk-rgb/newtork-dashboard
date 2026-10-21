// 관리자 설정 입력 검증 (Server Action에서 다시 검사)
import { z } from "zod";

const role = z.enum(["ADMIN", "MANAGEMENT", "LEADER", "MEMBER"]);
const teams = z.array(z.enum(["production", "service"])).max(2);

export const saveChangesSchema = z.object({
  changes: z
    .array(
      z.object({
        id: z.string().min(1).max(64),
        role,
        viewTeams: teams,
        editTeams: teams,
        expectedUpdatedAt: z.iso.datetime(),
      }),
    )
    .min(1)
    .max(200),
});
export type SaveChangesInput = z.input<typeof saveChangesSchema>;

export const rowTargetSchema = z.object({ id: z.string().min(1).max(64) });

export const LOGIN_ID_RULE = "아이디는 영문 소문자·숫자·밑줄(_) 3~30자입니다.";

export const createUserSchema = z.object({
  loginId: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]{3,30}$/, LOGIN_ID_RULE),
  name: z
    .string()
    .trim()
    .min(1, "이름을 입력하세요.")
    .max(30, "이름은 30자 이하로 입력하세요."),
  role,
  viewTeams: teams,
  editTeams: teams,
});
export type CreateUserInput = z.input<typeof createUserSchema>;

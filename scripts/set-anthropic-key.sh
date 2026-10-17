#!/usr/bin/env bash
# .env 의 ANTHROPIC_API_KEY 를 안전하게 넣는다 (npm run env:set-key)
# - 입력은 화면에 보이지 않고(read -s), 명령줄 인자로 받지 않으므로 셸 기록에도 남지 않는다
# - 키 값은 어디에도 출력하지 않는다 (길이만 표시)
# - 바꾸기 전에 .env 를 .env.bak-<시각> 으로 백업 (.gitignore 의 .env* 로 git 제외)
set -euo pipefail

cd "$(dirname "$0")/.."

KEY_NAME="ANTHROPIC_API_KEY"

printf "API 키 붙여넣기: "
IFS= read -rs key || true
printf "\n"

# 붙여넣을 때 섞인 앞뒤 공백·줄바꿈(CR) 제거
key="$(printf '%s' "$key" | tr -d '\r\n' | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"

if [ -z "$key" ]; then
  echo "⚠️  입력이 비어 있습니다. 저장하지 않았습니다."
  exit 1
fi
case "$key" in
  sk-ant-*) ;;
  *)
    echo "⚠️  Anthropic API 키는 sk-ant- 로 시작해야 합니다. 저장하지 않았습니다."
    unset key
    exit 1
    ;;
esac
case "$key" in
  *[[:space:]]* | *\"* | *\'* | *\\*)
    echo "⚠️  키에 공백·따옴표·역슬래시가 들어 있습니다. 다시 복사해 주세요. 저장하지 않았습니다."
    unset key
    exit 1
    ;;
esac

if [ ! -f .env ]; then
  cp .env.example .env
  echo ".env 가 없어 .env.example 을 복사해 만들었습니다."
fi

backup=".env.bak-$(date +%Y%m%d-%H%M%S)"
cp -p .env "$backup"

# 키를 명령줄 인자로 넘기지 않도록(ps 에 보이지 않게) 환경변수로 awk 에 전달
tmp="$(mktemp .env.tmp.XXXXXX)"
trap 'rm -f "$tmp"' EXIT
NEW_KEY="$key" awk -v name="$KEY_NAME" '
  BEGIN { done = 0 }
  $0 ~ "^[[:space:]]*(export[[:space:]]+)?" name "=" {
    if (!done) { print name "=\"" ENVIRON["NEW_KEY"] "\""; done = 1 }
    next
  }
  { print }
  END { if (!done) print name "=\"" ENVIRON["NEW_KEY"] "\"" }
' .env > "$tmp"
chmod 600 "$tmp"
mv "$tmp" .env
trap - EXIT

length=${#key}
unset key
echo "저장 완료 (길이 ${length}자) — 백업: ${backup}"
echo "실행 중인 dev 서버가 있으면 다시 시작해야 새 키가 적용됩니다."

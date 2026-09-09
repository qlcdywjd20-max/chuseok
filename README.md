# 온(ON)마을 복(福) 터졌네! — 실시간 행사판

기존 29칸 디자인·지름길·잡기·응원전·골든미션에 Supabase 서버 저장을 추가했습니다.

- `/` 또는 `/game`: 로그인 없는 관람 화면. 관리자 버튼 없음.
- `/admin`: 담당자 로그인과 조작. 이전 `/display`, `/control`도 호환됩니다.
- 기본 20초, 문제별 제한시간 우선. 정답은 담당자가 공개해야 보입니다.
- 구청장팀 하늘색 / 관장팀 노란색 / 지회장팀 초록색.

**Supabase 설정 전에는 윷판 미리보기와 설정 안내가 나오며 게임 조작은 잠겨 있습니다. HTML 더블클릭으로 여러 PC가 연동되는 방식이 아닙니다.**

## 1. Supabase 준비

1. [Supabase](https://supabase.com/dashboard)에 로그인 → **New project**를 누릅니다.
2. 이름과 DB 비밀번호를 정합니다. 비밀번호를 GitHub나 채팅에 올리지 마세요.
3. 프로젝트 생성 후 **SQL Editor → New query**에서 이 프로젝트의 `supabase.sql` 전체 내용을 붙여넣고 **Run**을 누릅니다.
4. SQL은 기본 29칸 문제·테이블·RLS·저장 함수·Realtime publication을 만듭니다. 다시 실행해도 진행 중 상태를 덮어쓰지 않습니다.

## 2. 관리자 계정

1. **Authentication → Users → Add user → Create new user**에서 관리자 이메일·비밀번호로 계정을 만듭니다. 필요하면 이메일 확인 옵션을 켭니다.
2. 해당 사용자의 **User UID**를 복사합니다.
3. SQL Editor에서 아래의 예시 부분을 실제 UID로 바꿔 실행합니다.

```sql
insert into public.game_admins(user_id)
values ('여기에-복사한-User-UID')
on conflict do nothing;
```

담당자를 추가할 때도 반복합니다. 일반 회원가입은 Authentication 설정에서 꺼 두세요. 회원가입만으로 관리자 권한이 생기지는 않습니다. 권한 회수는 `delete from public.game_admins where user_id='해당-UID';`입니다.

## 3. 내 컴퓨터에서 실행

Node.js 22 이상 설치 후 프로젝트 폴더에서 터미널을 엽니다.

```sh
npm install
```

`.env.example`을 복사해서 **`.env.local`**로 저장합니다. `.txt`가 붙지 않게 주의하세요.

```dotenv
VITE_SUPABASE_URL=https://실제프로젝트.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=실제공개키
```

Supabase의 **Connect** 또는 **Settings → API Keys**에서 Project URL과 **Publishable key**를 복사합니다. 구형 `anon` 키는 `VITE_SUPABASE_ANON_KEY`로 넣어도 됩니다. **Secret key / service_role 키는 넣지 마세요.** 빌드에서도 차단합니다.

```sh
npm run dev
```

- 관람: http://127.0.0.1:5173/game
- 담당자: http://127.0.0.1:5173/admin

로그인 후 **조작권 이어받기**를 누릅니다. 환경변수 변경 후 개발 서버를 종료하고 다시 실행하세요.

## 4. Vercel 공개 주소

1. [Vercel](https://vercel.com/new)에 GitHub 계정으로 로그인합니다.
2. **Add New → Project**에서 `qlcdywjd20-max/chuseok`을 Import 합니다.
3. Framework **Other**, Root Directory **저장소 루트**, Build Command **npm run build**, Output Directory **dist**로 설정합니다.
4. **Environment Variables**에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`를 각각 추가합니다. Production에 적용하고 필요하면 Preview에도 적용합니다.
5. **Deploy**를 누르면 실제 `https://…vercel.app` 주소가 발급됩니다.
6. 그 주소의 `/game`은 TV PC, `/admin`은 담당자 PC에서 엽니다.
7. Supabase **Authentication → URL Configuration**의 Site URL에 실제 Vercel 주소를 입력합니다.
8. 환경변수를 나중에 바꿨다면 Vercel에서 **Redeploy**합니다.

GitHub 연결과 Production Branch가 `main`이면 main 변경이 자동 배포됩니다. **GitHub 저장소 주소는 게임 실행 주소가 아닙니다.**

## 5. 다른 컴퓨터

사용만 할 때는 설치 없이 Vercel 주소로 접속합니다. 모든 PC가 같은 Supabase 프로젝트를 사용해야 합니다. 소스 수정은:

```sh
git clone https://github.com/qlcdywjd20-max/chuseok.git
cd chuseok
npm install
# 이 PC에도 .env.local 작성
npm run dev
```

## 6. 진행과 연결 복구

- 여러 관리자가 로그인할 수 있지만 **조작권은 한 창**만 가집니다. 다른 PC에서 이어받으면 이전 창의 쓰기를 서버가 거부합니다.
- **오프닝** 또는 **윷판으로** 시작합니다. 윷 결과 직접 선택 또는 **윷 던지기**를 사용할 수 있습니다. 윷 던지기는 다섯 결과 중 균등 무작위입니다.
- 이동할 때 각 칸을 서버에 순서대로 저장하고 관람 화면이 Realtime으로 받아 애니메이션을 재생합니다.
- 문제 선택·다음 문제·건너뛰기, 말 수동 위치, 점수 입력과 +/−, 실행취소를 지원합니다.
- 타이머는 시작·정지·다시 시작·+10초·즉시 종료를 지원합니다. 서버 시각으로 보정한 절대 종료시각을 사용하여 새로고침해도 처음부터 시작하지 않습니다.
- 인터넷이 끊기면 마지막 화면을 유지하고 담당자의 저장 불가능한 조작은 중지합니다. 연결 복구 후 **조작권 이어받기**를 누릅니다.
- 담당자 창을 모두 닫으면 자동 연출 전환은 멈출 수 있습니다. 관람 타이머는 계속 계산되며 관리자 재접속 후 종료 단계가 처리됩니다. 행사 중 담당자 창 한 개는 유지하세요.
- 이동 중 창을 닫았으면 재접속 시 중단 안내가 나옵니다. 실행취소나 말 위치 수정으로 이어갑니다.
- Realtime 외에도 4초마다 저장 상태를 확인해 누락된 변경을 복구합니다. 반영 속도는 인터넷 상태에 영향을 받습니다.
- LIVE/50개소는 행사 연출이며 실제 화상회의 참가자 수를 측정하지 않습니다.

## 7. 문제은행

기본 데이터는 `board-data.json`, 서버 초기 데이터는 `supabase.sql`입니다. 실제 진행 원본은 `game_private.state.bank`에 저장됩니다. 소스 JSON만 수정해서 배포해도 진행 중 문제를 덮어쓰지는 않습니다.

**Google Sheets 문제은행**에서 구글시트 공유 주소 또는 Apps Script 웹앱 `/exec` 주소를 입력하고 **문제 새로고침**을 누릅니다. 구글시트 직접 연결은 링크로 열람 가능한 시트에서 사용할 수 있습니다. 기존 Apps Script 연결도 지원합니다. 시트 수정이 자동으로 게임에 반영되지는 않으며, 담당자가 조작권을 가진 상태로 윷판 또는 오프닝 화면에서 새로고침해야 합니다. 불러온 문제와 원본 주소는 Supabase에 함께 저장됩니다. 문제은행 반영 결과와 게임 서버 연결 상태를 따로 표시합니다.

`스마트경로당퀴즈` 유형도 지원합니다. 시트는 필수 열 이름을 유지해야 하며, 내용에 쉼표·따옴표·줄바꿈을 사용할 수 있습니다. 문제 형식이나 연결 검사에 실패하면 기존 문제를 덮어쓰지 않습니다.

열: `칸번호 / 유형 / 제목 / 문제 / 보기1 / 보기2 / 보기3 / 보기4 / 정답 / 미션내용 / 제한시간 / 사용여부`

객관식은 보기 4개와 정답(1~4 또는 보기 내용), 미션은 보기·정답 없이 미션내용을 입력합니다. 제한시간 기본 20초, 행별 5~600초. FALSE는 쉼터입니다. 공개 저장소의 기본 예시는 공개 자료이므로 중요한 실제 행사 문제는 시트에서 불러오세요.

## 8. 구조·보안

- `index.html`: 기존 추석 방송 화면과 CSS.
- `app.js`: 윷 경로·이동·퀴즈·타이머·응원·점수.
- `cloud.js`: 로그인·조작권·저장 대기열·Realtime·서버 시각 보정.
- `supabase.sql`: 테이블·RLS·원자적 저장 RPC·초기 데이터.
- `game_state.state`: 공개 상태. selected(팀), scores, players.path(위치), card(현재 문제), currentQuestionNumber, answerRevealed, timer(startedAt/deadline/running/remaining), screen/phase.
- `game_private.state/history`: 전체 문제은행·원본 상태·실행취소. version/owner/lease_until로 저장 충돌과 조작권을 검사합니다.
- `game_admins`: 허가된 Auth UID 명단. 브라우저 수정 불가.
- 관람자는 공개 상태 SELECT만 가능합니다. 관리자는 권한·조작권·버전을 검사하는 RPC로 저장합니다.
- 공개 전 정답과 문제은행은 관람 데이터에서 제거합니다. 정답은 공개 단계에서 전달됩니다.
- `.env*`는 Git에서 제외하고 `.env.example`만 올립니다. 서버 secret key는 필요 없습니다.

공식 문서: [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Realtime](https://supabase.com/docs/guides/realtime/postgres-changes), [API 키](https://supabase.com/docs/guides/api/api-keys), [Vercel GitHub 배포](https://vercel.com/docs/git/vercel-for-github).

## 9. 검사

```sh
npm run build
npm test
```

게임 로직과 로컬 PostgreSQL(PGlite)의 RLS·관리자 권한·정답 보호·저장 충돌·조작권 이전을 검사합니다. 실제 Supabase Realtime, 로그인, 서로 다른 PC 연결은 서버 설정 후 아래를 확인하세요.

1. PC A `/admin` 로그인, PC B `/game` 열기.
2. 점수 +1, 말 이동, 문제 공개가 B에 새로고침 없이 표시되는지 확인.
3. B 새로고침 후 상태와 타이머 유지 확인.
4. 다른 관리자 PC가 조작권을 이어받으면 이전 창이 중지되는지 확인.
5. 로그아웃 상태에서 조작할 수 없는지 확인.

실제 프로젝트 URL·키·관리자 계정은 포함하지 않았습니다. Supabase/Vercel 설정 후 공개 주소를 사용할 수 있습니다.

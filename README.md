# 온(ON)마을 복(福) 터졌네!

동백꽃노인종합복지관 스마트경로당 추석 윷놀이 골든벨입니다.

## 다른 컴퓨터에서 실행
GitHub의 **Code → Download ZIP**으로 내려받아 압축을 풉니다.
- 바로 보기: index.html을 더블클릭합니다.
- 안정적인 두 화면 실행: Node.js 20 이상 설치 후 아래 명령을 실행합니다.

```sh
npm install
npm run dev
```

진행자는 http://127.0.0.1:5173/control, 방송은 http://127.0.0.1:5173/display 입니다.
동일한 컴퓨터·브라우저 프로필에서 두 창을 엽니다. 게임 상태는 각 PC의 브라우저에 보관되며 서로 다른 PC끼리 자동 동기화되지는 않습니다.

## Vercel에 배포해 주소로 사용
1. Vercel 로그인 → Add New → Project → 이 GitHub 저장소 선택.
2. Framework: Other, Build Command: npm run build, Output Directory: dist.
3. Deploy 완료 후 발급된 주소 뒤에 /control 또는 /display를 붙입니다.

GitHub 저장과 웹사이트 공개는 별도입니다. Vercel 배포 후에 공개 주소가 생성됩니다.

## 검사
```sh
npm run build
npm test
```

## 문제 수정
기본 문제와 게임 코드는 index.html에 포함되어 있습니다. 기본 문제는 DEFAULT_BANK를 검색해 수정합니다. Google Sheets 연결 설정은 진행자 화면에 있습니다. 현재 실제 API 연결은 Google 권한 승인과 배포 주소 입력이 남아 있습니다.

팀 색상: 구청장팀 하늘색, 관장님팀 노란색, 지회장님팀 초록색.
글꼴·그림이 파일 내부에 있어 외부 라이브러리가 필요하지 않습니다. Jua 글꼴 SIL OFL 라이선스는 HTML 주석에 포함했습니다.

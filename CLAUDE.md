# CLAUDE.md

이 파일은 Claude Code가 **insta-card-dashboard** (부동산 인스타 @aptshowhome용 카드뉴스·블로그 콘텐츠 제작 도구) 저장소에서 작업할 때 반드시 따라야 하는 규칙을 담고 있다.

스택: Next.js 16 App Router + React 19 + TypeScript + Tailwind v4 + Supabase + Vercel.

---

## 🚫 절대 수정 금지

아래 파일/흐름은 과거에 손대려다 `blocks` 구조가 깨져서 크게 고생한 이력이 있다. **수정이 필요해 보여도 먼저 사용자에게 확인받고, 명시적으로 허락받은 범위 안에서만 최소한으로 건드릴 것.**

- [src/components/cardnews/BlockRenderer.tsx](src/components/cardnews/BlockRenderer.tsx) — `SlideBlock[]` 렌더링, `fitScale` 자동 축소, 드래그 이동(`onBlockOffsetChange`) 로직 보유
- [src/components/cardnews/SlideFrame.tsx](src/components/cardnews/SlideFrame.tsx) — 슬라이드 캔버스 래퍼
- [src/lib/cardnews/theme.ts](src/lib/cardnews/theme.ts) — 브랜드 톤(`gold`/`sage`) + `GLASS` 스타일 토큰
- [src/app/api/generate/smart-cardnews/route.ts](src/app/api/generate/smart-cardnews/route.ts)
- **완전자동(4번 방식) 카드뉴스 흐름 전체** — 위 파일들이 서로 맞물려 동작하는 자동 생성 파이프라인 전체를 의미. 한 곳만 고쳐도 다른 곳이 깨질 수 있다.

이 목록에 없는 파일이라도 위 흐름과 데이터 구조(`SlideBlock`, `blocks.ts`)를 공유한다면 같은 수준의 주의를 기울인다.

---

## ✅ 작업 규칙

- 코드 변경 후 반드시 `npx tsc --noEmit` 통과를 확인한다. (테스트 스위트는 없음 — `npm test` 가정 금지)
- 편집 캔버스(`src/app/cardnews/editor`) 관련 수정 시 `recomputeNonce` 무한루프에 주의한다. `BlockRenderer`의 `fitScale`은 폰트 로드(`document.fonts.ready`)와 `ResizeObserver`에 반응해 재계산되므로, 이 재계산을 트리거하는 state를 의존성에 잘못 넣으면 무한 렌더링으로 이어질 수 있다.
- **브라우저에서 눈으로 직접 확인하기 전에는 커밋하지 않는다.** `npm run dev`로 실행 후 실제 화면에서 동작을 검증할 것.

---

## 🔧 git 규칙

- 커밋 전 반드시 `git status`로 변경 범위를 확인한다.
- `git add`는 파일명을 콕 집어 지정한다. `git add .` / `git add -A` 금지.
- `git push --force` 금지.
- `.env` / `.env.local`은 절대 커밋하지 않는다 (`.gitignore`에 `.env*`로 이미 제외되어 있음 — 새 env 관련 파일 추가 시에도 이 규칙 유지).

---

## 🗄️ Supabase 주의사항

- **서버 라우트에서는 반드시 `SUPABASE_SERVICE_ROLE_KEY`를 사용한다.** anon key로 폴백하면 RLS 때문에 INSERT가 조용히 실패하고 에러도 잡히지 않는 사고가 실제로 있었다.
- ⚠️ 현재 [src/lib/supabase-server.ts](src/lib/supabase-server.ts)의 `createSupabaseServer()`와 [src/lib/supabase.ts](src/lib/supabase.ts)의 `supabase`는 둘 다 **anon key**로 동작한다 (쿠키 기반 세션용). service role이 필요한 서버 라우트(현재 `api/dashboard`, `api/briefing`, `api/briefing/to-blog`, `api/upload-image`에서 개별적으로 `SERVICE_ROLE_KEY`를 사용 중)에서는 이 두 헬퍼를 그대로 쓰지 말고, service role 클라이언트를 명시적으로 생성해서 사용할 것. RLS를 우회해야 하는 새 INSERT/UPDATE 라우트를 추가할 때 이 구분을 놓치지 않는다.
- 스키마 변경은 저장소 루트의 SQL 파일(`supabase_card_designs.sql`, `update_schema.sql`, `update_persona_schema.sql`)과 같은 스타일로 새 파일을 추가한다. 기존 파일을 직접 고치지 않는다.
- 기존 RLS 정책은 `USING (true)`로 permissive하다 (`auth.uid()` 스코핑 아님) — 새 테이블/정책 추가 시 이 점을 인지하고 필요하면 사용자와 상의한다.

---

## 🤖 AI 호출

- Gemini는 429가 잦다. 카피/텍스트 생성은 [src/lib/gemini.ts](src/lib/gemini.ts)의 `generateWithRetry()`를 통해야 한다 (Gemini `2.5-flash` → 5초 대기 후 `2.5-flash-lite` → 마지막 폴백으로 [src/lib/ai/openrouter.ts](src/lib/ai/openrouter.ts)의 `callOpenRouter`(`callAI`의 alias) 사용, deepseek 모델). AI SDK를 직접 호출하지 말고 이 패턴을 따른다.
- JSON 응답을 받을 때는 `maxTokens` 최소 4000으로 설정한다.
- `JSON.parse` 전에 마크다운 코드펜스(```` ```json ````)를 반드시 제거한다. 기존 라우트(`/api/generate-card`, `/api/ai-designer`, `/api/analyze` 등)의 fence-stripping 패턴을 그대로 따를 것 — structured output 강제는 없다.
- 에러는 서버 사이드에서 `toKoreanError()`(gemini.ts), 클라이언트 안전 경로에서는 `friendlyError()`([src/lib/errors.ts](src/lib/errors.ts))로 한국어 메시지로 변환한다.

---

## 아키텍처 참고

### 인증 & 라우트 보호

Supabase Auth(`@supabase/ssr`)가 `middleware.ts`에서 전체 접근을 게이트한다 (라우트별 개별 체크 아님):
- `PUBLIC_PAGE_PATHS` / `PUBLIC_API_PATHS`가 허용 목록이고, 나머지는 세션 필요.
- `PROTECTED_API_PREFIXES`가 `/api/*` 인증 필요 여부의 기준. 기존 prefix 하위에 새 라우트를 추가하면 자동으로 보호되지만, 완전히 새로운 top-level prefix는 이 목록에 명시적으로 추가해야 한다.
- 보안 헤더(`X-Frame-Options` 등)는 `middleware.ts`와 `next.config.ts` 양쪽에 있다 — 변경 시 동기화 유지.
- Supabase 클라이언트 3종은 컨텍스트별로 분리되어 있으니 섞어 쓰지 않는다: `src/lib/supabase.ts`(anon), `src/lib/supabase-server.ts`(`createSupabaseServer()`, 쿠키 인식, 서버 컴포넌트/라우트 핸들러용), `src/lib/supabase-browser.ts`(`createSupabaseBrowser()`, 클라이언트 컴포넌트용).

### 카드뉴스 도메인 모델 (`src/lib/cardnews/`)

- `blocks.ts`: `SlideBlock`은 태그드 유니온(`eyebrow`, `headline`, `sub`, `bigNumber`, `statGrid`, `compareTable`, `timeline`, `checklist`, `badgeRow`, `sourceNote`), 각각 수동 위치 조정용 `offsetY` 보유. 모든 픽셀값은 420px 폭 캔버스 좌표계 기준.
- 에디터 UI: `src/app/cardnews/editor/page.tsx` / 갤러리: `src/app/cardnews/page.tsx`.

### 데이터 저장

Supabase Postgres, 스키마는 저장소 루트의 수동 SQL 파일로 관리 (`supabase/migrations` 디렉토리 없음). 주요 테이블: `card_designs`(id, name, description, `pages_data` JSONB, category), `brand_personas`(persona_name, `user_id` FK → `auth.users`, cascade delete).

### 내보내기/렌더링

슬라이드 → 이미지/PDF 변환은 클라이언트에서 `html-to-image` / `html2canvas` + `jspdf` + `jszip`로 처리 (렌더링된 `BlockRenderer` DOM 대상, 서버 사이드 아님).

### SNS 연동 & 스케줄링

`/api/instagram/*`가 OAuth(`auth`, `callback`)/발행/인사이트/설정 담당. `vercel.json`에 Vercel Cron 라우트 2개: `/api/cron/instagram`(매일 09:00 UTC), `/api/briefing`(매일 23:00 UTC). Threads/TikTok/YouTube 관련 env는 존재하지만 실제로 라우트에 연결됐는지 확인 후 사용할 것.

### 컨벤션

- 사용자 노출 문자열, 코드 주석, 에러 메시지는 대부분 한국어 — 새 UI 텍스트/주석도 이에 맞춘다.
- `next.config.ts`는 사내 프록시 우회를 위해 non-production에서 `NODE_TLS_REJECT_UNAUTHORIZED = '0'`을 설정한다 — dev 전용, 이유 확인 없이 제거 금지.
- 경로 별칭 `@/*` → `./src/*` (`tsconfig.json` 참고).

## Commands

```bash
npm run dev      # 개발 서버 (http://localhost:3000)
npm run build    # 프로덕션 빌드
npm run start    # 프로덕션 서버 실행
npm run lint     # eslint (flat config: eslint-config-next core-web-vitals + typescript)
npx tsc --noEmit # 타입 체크만 (테스트 러너 없음)
```

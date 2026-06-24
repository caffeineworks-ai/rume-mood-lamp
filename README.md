# rume — 발광버섯 무드램프 시뮬레이터

침실 평면도에 발광버섯 조명을 배치하고, Claude와 대화하며 실시간으로 제어하는 MCP 연동 웹 프로젝트입니다.

---

## 학생 가이드 — 순서대로 따라하세요

### Step 1. claude.ai 커스텀 커넥터 추가

1. [claude.ai](https://claude.ai) 접속 후 로그인
2. 좌측 하단 **설정(Settings)** 클릭
3. **Integrations** 메뉴 클릭
4. **Add custom integration** 클릭
5. 아래 URL 입력:
   ```
   https://rume-mood-lamp.typica-918.workers.dev/mcp
   ```
6. 연결 완료 후 도구 목록에 아래 4개가 보이면 성공:
   - `rearrange_furniture` — 가구 재배치
   - `place_lights` — 조명 배치
   - `shuffle_lights` — 조명 셔플
   - `get_order_summary` — 주문 금액 조회

---

### Step 2. 레포 포크

1. 이 레포 우측 상단 **Fork** 클릭
2. 본인 GitHub 계정으로 포크

---

### Step 3. GitHub Pages 활성화

1. 포크된 레포 → **Settings** 탭
2. 왼쪽 메뉴 **Pages** 클릭
3. **Source** → **Deploy from a branch**
4. Branch: `main` / folder: `/docs`
5. **Save**
6. 잠시 후 아래 주소로 접속 확인:
   ```
   https://<내-깃허브-아이디>.github.io/rume-mood-lamp/
   ```

---

### Step 4. index.html 수정

GitHub 웹에서 직접 수정합니다.

1. 포크된 레포에서 `docs/index.html` 클릭
2. 우측 상단 연필 아이콘(Edit) 클릭
3. 내용 수정 후 **Commit changes** 클릭
4. 잠시 후 GitHub Pages에 자동 반영

---

### Step 5. Claude와 대화하며 시뮬레이터 제어

claude.ai 채팅창에서 아래처럼 말해보세요:

> "가구 재배치해줘"  
> "조명 배치해줘"  
> "조명 셔플해줘"  
> "현재 조명 구매하고 싶어"

웹페이지가 열려 있으면 2초 안에 자동으로 반영됩니다.

---

## 가격 수정 방법

가격을 바꾸려면 **두 파일을 모두** 수정해야 합니다.

**1. `docs/index.html`** — 구매하기 모달에 표시되는 가격

```javascript
// 약 457번째 줄 부근
const prices = { 5: 49000, 7.5: 69000, 10: 89000 };
```

**2. `src/index.ts`** — Claude가 `get_order_summary` tool로 계산하는 가격

```typescript
// get_order_summary tool 내부
const prices: Record<number, number> = { 5: 49000, 7.5: 69000, 10: 89000 };
```

두 파일의 가격이 다르면 버튼으로 볼 때와 Claude가 알려주는 금액이 달라집니다.

---

## 주의사항

- MCP 서버는 **팀 공용**입니다. 동시에 여러 명이 tool을 호출하면 상태가 덮어써집니다. **한 명씩 순서대로** 조작하세요.
- 개발 중 테스트는 페이지의 버튼을 직접 클릭해서 하고, Claude 연동은 발표 시연 때 사용하세요.

---

## 파일 구조

```
rume-mood-lamp/
├── docs/
│   └── index.html      ← 여러분이 수정할 웹페이지
├── src/
│   └── index.ts        ← MCP 서버 (가격 수정 시 함께 수정)
├── wrangler.toml
└── package.json
```

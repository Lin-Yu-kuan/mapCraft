# AGENTS.md — MapCraft AI 開發規則

本檔是給 AI coding agent（Cursor / Claude Code / Copilot / Codex 等）的**強制規則**。
完整需求見 `SPEC.md`；若本檔與 SPEC 衝突，**以本檔為準**，並在 PR 中提出衝突點。

---

## 0. 專案一句話

**MapCraft（地圖工坊）** — 純前端（無後端）、BYOK 的心智圖 AI 學習網站：輸入主題 → LLM 產生 JSON 樹狀學習地圖 → 互動畫布 → 點節點生成教材 → 進度追蹤 → 本機儲存。

> Tagline：*AI drafts the map. You craft the learning.*（AI 起稿，你來完成。）
> 詞彙：一張地圖 = 一個 **craft**；清單 = *Your crafts*；動作 = *Craft a map*。文案沿用這套，別另創 project / board / workspace。

**技術基線**：Vite + React 19 + TypeScript(strict) + React Flow + Tailwind + Zustand + TanStack Query + Dexie + Zod + i18next。
**授權**：MIT。**語言**：UI 與 AI 輸出以繁體中文（zh-TW）為主。

---

## 1. 絕對禁止（Never Do）

1. **禁止新增任何後端**：不得引入 express/hono/fastify/伺服器端 API route/server action/雲端函式。本專案必須能部署成純靜態檔。
2. **禁止在元件、頁面、hook 內直接 `fetch`**。所有網路請求只能經 `src/lib/llm/*`。
3. **禁止洩漏 API Key**：不得寫入 log、URL、錯誤訊息、IndexedDB、cookie、測試 fixture、匯出檔、issue 範例。一律經 `redact()`。
4. **禁止 `domain/` import React 或任何網路/儲存程式碼**（純函式層）。
5. **禁止未經使用者同意新增第三方依賴**。先說明用途與 bundle 影響，取得同意再裝。
6. **禁止 `any`、禁止無理由的 `@ts-ignore` / `@ts-expect-error`**。
7. **禁止「順手重構」**：不修改與當前 ticket 無關的檔案、不刪除既有註解、不改格式。
8. **禁止修改契約**：`src/domain/types.ts`、`src/domain/schemas.ts`、`promptVersion`、備份檔格式，未經明確指示不得變更。
9. **禁止把 AI 輸出直接注入 DOM**：不得使用 `dangerouslySetInnerHTML`（除唯一經 sanitize 的入口），不得 eval / new Function / 注入 script。
10. **禁止為了讓測試通過而放寬驗證或刪測試**。
11. **禁止修改「識別字凍結表」**（SPEC §4.5）：IndexedDB 名稱 `mapcraft`、storage key `mapcraft.settings.v1` / `mapcraft.key.*` / `mapcraft.collapsed.*`、備份格式 `mapcraft.backup`。這些字串只能出現在 `src/lib/storage/keys.ts` 一處並以常數匯出；改動需附 migration。

---

## 2. 必遵守（Always Do）

1. **先看 Golden Path 再動手**：
   - 新功能模組 → 照 `src/features/map/` 的結構（`index.ts` → 元件 → hooks → 型別）
   - 新 provider → 照 `src/lib/llm/openaiCompatible.ts`
   - 新資料表操作 → 照 `src/lib/db/repos/maps.ts`
2. **純邏輯放 `domain/`，先寫測試再實作**（tree、progress、layout、json parser、prompt builder）。
3. **錯誤一律轉 `NormalizedError`**（`src/lib/llm/errors.ts`），由 UI 轉成人話；不得把原始 API 錯誤直接丟給使用者。
4. **每個畫面/元件都要處理四態**：loading / empty / error / success。
5. **所有 UI 字串走 i18n**（`src/lib/i18n/zh-TW.json` 必填），禁止在元件 hardcode 中文。
6. **工程邊界**（由 eslint-plugin-boundaries 強制）：
   `app → features → domain → lib → shared`，反向依賴一律違規。
7. **定義完成（DoD）**：有測試、`pnpm check` 全綠、無新增 `any`、四態齊全、行動裝置 375px 可用、動到 schema 要附 migration。

---

## 3. 驗證指令（完成前必跑）

```bash
pnpm lint          # ESLint（含模組邊界）
pnpm typecheck     # tsc --noEmit
pnpm test          # Vitest 單元 + 元件
pnpm build         # 確認可靜態產出
pnpm test:e2e      # 動到 UI / 流程時必跑
```

一次跑完：`pnpm check`

**回報格式**：貼出上述指令的實際輸出結尾（不得只說「已通過」）。若失敗，先修正再回報，不得繞過。

---

## 4. 變更範圍與提問

- 一次 ticket 只動一組相關檔案；若發現必須改動範圍外的檔案，**先說明原因並等待確認**。
- 需求有歧義時，列出 2–3 個具體選項提問，不要自行發明產品行為。
- 若規格與實作衝突，先寫下衝突點再停手。

---

## 5. 常用任務的提示詞樣板（給人類複製）

```
請依 SPEC.md 的 FR-04 實作「節點教學抽屜」。
可修改：src/features/lesson/**、src/domain/prompts/lesson.zh-TW.ts
不可修改：src/domain/types.ts、src/lib/llm/**
先補測試，再實作，最後跑 pnpm check 並貼出輸出。
```

```
請在不改變外部行為的前提下，為 src/lib/llm/json.ts 補上單元測試，
涵蓋：code fence、尾隨逗號、全形引號、BOM、截斷 JSON。
不得修改實作邏輯；若發現 bug，先回報再修。
```

---

## 6. 交付前自檢清單

- [ ] 沒有新增後端、沒有元件內 fetch
- [ ] 沒有金鑰出現在 log / DOM / URL / 匯出 / 測試
- [ ] 契約檔（types / schemas / promptVersion）未被改動（或已說明理由）
- [ ] 四態齊全、i18n 字串齊全
- [ ] `pnpm check` 全綠（附輸出）
- [ ] PR 說明：改了什麼、為什麼、如何驗證、影響哪些 FR 編號

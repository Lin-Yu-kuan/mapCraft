# 貢獻指南（Contributing to MapCraft）

感謝您考慮為 MapCraft（地圖工坊）做出貢獻！

MapCraft 是一個開源、純前端、無後端、BYOK（自備金鑰）的心智圖 AI 學習工具。為確保程式碼品質與使用者隱私安全，請在開始貢獻前閱讀本指南。

---

## 核心紅線（不可違反）

1. **純前端無後端**：不得引入任何伺服器端執行環境、API route 或雲端函式。
2. **禁止金鑰洩漏**：不得將 API Key 寫入 Log、URL、錯誤訊息、測試 fixture 或匯出檔中。
3. **禁止直接 fetch**：元件、Hook 或 Page 內禁止直接呼叫 `fetch`，所有網路請求皆需透過 `src/lib/llm/*`。
4. **禁止任意新增第三方套件**：若有新相依套件需求，請先提出 Issue 討論用途與 bundle 大小影響。
5. **架構邊界遵循**：依賴流向嚴格維持 `app → features → domain → lib → shared`，純函式邏輯請置於 `domain/`。

---

## 本地開發起步

### 1. 環境需求
- Node.js >= 20
- pnpm >= 9

### 2. 安裝與執行
```bash
# 安裝依賴
pnpm install

# 啟動本機開發伺服器
pnpm dev

# 執行品質檢查（ESLint + TypeScript + Vitest）
pnpm check
```

---

## 常見擴充指南

### 1. 如何新增 LLM 供應商（Provider）
1. 參考 `src/lib/llm/openaiCompatible.ts` 與 `src/lib/llm/registry.ts`。
2. 在 `src/lib/llm/registry.ts` 的 `DEFAULT_PROVIDERS` 陣列中新增供應商定義（包含 `id`、`name`、`defaultBaseUrl`、`recommendedMapModel`、`recommendedLessonModel`）。
3. 若該供應商為 OpenAI 相容協定，直接複用現有機制；若有特規 Header 或請求格式（如 Anthropic / Google Gemini），請於 `src/lib/llm/` 獨立模組實作並加入轉接器。
4. 在 `src/test/llm-registry.test.ts` 補齊測試。

### 2. 如何新增介面語系（i18n）
1. 複製 `src/lib/i18n/zh-TW.json` 為目標語言檔（例如 `en.json` 或 `zh-CN.json`）。
2. 在 `src/lib/i18n/index.ts` 中匯入並註冊至 `resources` 物件。
3. 確保所有鍵值對齊完整，禁止於 UI 元件中寫死字串。

---

## Commit 規範

本專案採用 [Conventional Commits](https://www.conventionalcommits.org/) 規範：

- `feat:` 新增功能
- `fix:` 修復問題
- `docs:` 文件更新
- `refactor:` 程式碼重構（未新增功能或變更對外行為）
- `test:` 新增或調整測試
- `chore:` 建置或工具設定調整

範例：
```
feat(map): 新增 OPML 格式匯出功能
fix(lesson): 修復抽屜切換時殘留前一節點內容的問題
```

---

## Pull Request 檢查清單（DoD）

在送出 PR 前，請確認以下事項：
- [ ] 執行 `pnpm check` 通過（ESLint、TypeScript、單元測試全數綠燈）。
- [ ] 執行 `pnpm build` 確認生產環境產物可成功建置。
- [ ] 新增或修改的功能已補齊對應的單元或整合測試。
- [ ] 所有畫面元件皆具備四態處理（Loading / Empty / Error / Success）。
- [ ] 無任何 API Key 出現在日誌、DOM、URL 或測試檔案中。
- [ ] 遵循專案架構邊界，未發生反向 import。

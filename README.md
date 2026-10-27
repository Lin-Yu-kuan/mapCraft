# MapCraft（地圖工坊）

> *AI drafts the map. You craft the learning.*（AI 起稿，你來完成。）

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

**MapCraft** 是一個免費、開源、純前端、無後端、BYOK（自備金鑰）的心智圖 AI 學習網站。  
使用者輸入任何想學習的主題 → LLM 規劃並產出樹狀學習地圖 → 互動畫布探索 → 點擊節點隨選生成微教學與測驗 → 打勾推進學習進度 → 所有紀錄保存在本機。

---

## 核心特色

1. **中文自學體驗優先**：專為自學者設計，文案與 Prompt 皆針對繁體中文語境調校，告別生硬翻譯。
2. **BYOK 透明與隱私安全**：完全無後端伺服器，不經手任何金鑰與費用；支援 OpenAI、Anthropic、Google Gemini、DeepSeek、OpenRouter、本地 Ollama 或任意 OpenAI 相容 API。
3. **地圖即課程**：節點不只是大綱，點擊即可依序展開「白話核心概念」、「為什麼重要」、「實戰範例」、「常見誤解」、「重點回顧」與「隨堂測驗」。
4. **資料自由帶走**：支援完整 JSON 備份還原、Markdown 結構化筆記匯出，以及心智圖軟體標準 OPML 匯出。
5. **極致輕量與快速自架**：純靜態網站設計，可一鍵部署至 Cloudflare Pages、Vercel、GitHub Pages 或自架 Docker。

---

## 隱私與安全聲明

- **零後端伺服器**：MapCraft 站方無任何後端伺服器與資料庫，不收集、不上傳亦不分析任何使用者資料。
- **金鑰絕對安全**：您的 API Key 僅儲存於您本機的瀏覽器 Storage 中（可選 LocalStorage、SessionStorage 或僅記憶體），發送請求時直接連線至您指定的 LLM 供應商端點，絕無任何中間代理。
- **CSP 規範說明**：因本專案採 BYOK 架構，使用者可自行設定任意合法的 Base URL（或公司內部 Gateway），因此 Content-Security-Policy 的 `connect-src` 允許 `https:` 及本地 Ollama（`http://localhost:*`、`http://127.0.0.1:*`）。

---

## 如何自架 / 本地部署

### 方法一：使用 Docker 快速自架（推薦）

只需 2 步即可透過 Docker 啟動：

```bash
# 1. 建置 Docker 映像檔
docker build -t mapcraft .

# 2. 啟動容器（監聽 8080 連接埠）
docker run -d -p 8080:80 --name mapcraft-app mapcraft
```
開啟瀏覽器前往 `http://localhost:8080` 即可開始使用！

---

### 方法二：Node.js 本地開發與靜態託管

```bash
# 1. 複製專案並安裝依賴
git clone https://github.com/Lin-Yu-kuan/mapCraft.git
cd mapCraft
pnpm install

# 2. 啟動開發伺服器
pnpm dev

# 3. 建置生產環境靜態產物
pnpm build
```

建置完成後，將 `dist/` 目錄下的所有檔案發布至任何靜態託管平台（Cloudflare Pages、Vercel、GitHub Pages、S3、Nginx）即可。  
若部署在 GitHub Pages 等子路徑，可於建置時傳入環境變數：`BASE_PATH=/mapCraft/ pnpm build`。

---

## 程式碼品質與測試

本專案遵循嚴格的自動化檢驗與架構邊界檢查：

```bash
# 執行所有檢查（ESLint 模組邊界 + TypeScript 嚴格型別 + Vitest 單元/元件測試）
pnpm check

# 僅執行單元測試
pnpm test
```

---

## 參與貢獻

歡迎提交 Issue 或 Pull Request！在開始之前，請先參閱 [CONTRIBUTING.md](./CONTRIBUTING.md)。

---

## 免責聲明

學習地圖與教材內容皆由 AI 模型即時規劃產出，可能存在不準確或幻覺風險。所有內容僅供自學與學習路徑參考，請於實際應用時自行查證關鍵知識。

---

## 授權條款

本專案依據 [MIT 授權條款](./LICENSE) 開源。

# MapCraft（地圖工坊）

> *AI drafts the map. You craft the learning.*（AI 起稿，你來完成。）

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Deploy to GitHub Pages](https://github.com/Lin-Yu-kuan/mapCraft/actions/workflows/deploy.yml/badge.svg)](https://github.com/Lin-Yu-kuan/mapCraft/actions/workflows/deploy.yml)

👉 **線上免安裝體驗（Live Demo）**：[https://Lin-Yu-kuan.github.io/mapCraft/](https://Lin-Yu-kuan.github.io/mapCraft/)  
*(免註冊、免伺服器、支援免金鑰 TypeScript 示範地圖或 WebGPU 離線大模型即刻試玩！)*

---

**MapCraft** 是一個免費、開源、純前端、無後端、BYOK（自備金鑰）的心智圖 AI 學習網站。  
使用者輸入任何想學習的主題 → LLM 規劃並產出樹狀學習地圖 → 互動畫布探索 → 點擊節點隨選生成微教學與測驗 → 打勾推進學習進度 → 所有紀錄保存在本機。

---

## 核心特色

1. **中文自學體驗優先**：專為自學者設計，文案與 Prompt 皆針對繁體中文語境調校，告別生硬翻譯。
2. **免安裝線上體驗（Live Demo）**：透過 GitHub Pages 免費託管，內建精選示範地圖（TypeScript 核心架構），免填金鑰點開即玩！
3. **支援純本機 WebGPU 模型**：無需任何 API 金鑰與連網，瀏覽器端透過 WebGPU 直接執行 3B / 1.5B 模型（如 Qwen 2.5），權重快取於本機，離線亦可使用。
4. **BYOK 透明與多元連線**：支援 OpenAI、Anthropic、Google Gemini、DeepSeek、OpenRouter、本地 Ollama 或自訂 OpenAI 相容端點。
5. **地圖即課程**：節點支援「學習模式」與「腦力激盪模式」，展開「白話核心概念」、「為什麼重要」、「實戰範例」、「常見誤解」、「重點回顧」與「隨堂測驗」。
6. **全方位格式匯出**：支援單一獨立 HTML 互動手冊（含樹狀導覽與完整筆記、支援列印 PDF）、Markdown 筆記、心智圖標準 OPML，以及完整 JSON 備份。
7. **極致輕量與自動部署**：純靜態前端架構，內建 GitHub Actions 自動部署至 GitHub Pages，亦可一鍵部署至 Vercel 或 Docker。

---

## 為什麼選擇 MapCraft？（與市面心智圖工具對比）

| 比較維度 | 市面傳統心智圖（XMind 等） | 市面新興 AI 心智圖 | **MapCraft（地圖工坊）** |
| :--- | :--- | :--- | :--- |
| **本質定位** | 繪圖與排版工具（整理已知思維） | 一次性文字發想工具 | **心智圖即完整教材**（個人化 AI 導師導航） |
| **節點深度** | 節點僅有文字標題，點開多為空 | 僅生成下層小標題，無實質教材 | **點擊隨選生成完整教案**（概念/範例/誤區/測驗） |
| **前後脈絡知覺** | 無前後依賴概念，各節點彼此孤立 | Prompt 容易內容重複或偏離主題 | **全路徑上下文傳遞**（精準感知上下階層與兄弟節點） |
| **商業模式** | 買斷或軟體訂閱制 | 昂貴月費制（$10~$20 USD/月） | **100% 免費開源 · 零後端 · BYOK 自備金鑰** |
| **本地離線模型** | ❌ 不支援 | ❌ 不支援 | **✅ 支援純前端 WebGPU**（瀏覽器免金鑰離線跑 3B 模型） |
| **隱私與安全** | 存在專有格式或廠商伺服器 | 發想與金鑰經第三方代理轉發 | **零後端伺服器**（金鑰直連官方端點，筆記存本機 IndexedDB） |
| **學習反饋閉環** | 單純靜態展示 | 無進度系統，看完即忘 | **進度狀態機、順序導引模式、互動式隨堂測驗** |
| **生態匯出相容** | 專有私有格式綁定 | 匯出格式有限，大多需付費升級 | **單檔 HTML 互動手冊、Markdown、通用 OPML、JSON** |

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

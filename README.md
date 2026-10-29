# MapCraft（地圖工坊）

> *AI drafts the map. You craft the learning.*（AI 起稿，你來完成。）

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Deploy to GitHub Pages](https://github.com/Lin-Yu-kuan/mapCraft/actions/workflows/deploy.yml/badge.svg)](https://github.com/Lin-Yu-kuan/mapCraft/actions/workflows/deploy.yml)

👉 **線上免安裝體驗（Live Demo）**：[https://Lin-Yu-kuan.github.io/mapCraft/](https://Lin-Yu-kuan.github.io/mapCraft/)  
*(免註冊、零後端伺服器、內建免金鑰 TypeScript 示範地圖即刻試玩，並支援一鍵安裝為 Windows / Mac 桌面應用程式！)*

---

**MapCraft** 是一個免費、開源、純前端、零後端、BYOK（自備金鑰）且採用 **Local-First（本地優先）** 架構的心智圖 AI 學習網站。  
使用者輸入任何想學習的主題與程度背景 → LLM 規劃並產出樹狀學習地圖 → 互動畫布探索 → 點擊節點隨選生成引導式深度教材與隨堂測驗 → 打勾推進學習進度 → 平常秒存本機，有網路時自動背景同步至您個人的 Google Drive，並支援一鍵分享地圖。

---

## 核心特色

1. **中文自學體驗優先**：專為自學者設計，文案與 Prompt 皆針對台灣繁體中文語境深度調校，告別生硬翻譯。
2. **引導式自由教學（地圖即課程）**：摒棄死板八股填空，AI 導師會依據知識點特性自由運用「生活化比喻、Markdown 比較表格、ASCII 流程架構圖、分段推導與程式碼範例」由淺入深引導，並附帶必備「隨堂測驗」；同時支援「學習模式」與「腦力激盪模式」。
3. **跨平台 PWA 桌面版一鍵安裝**：一般使用者無須下載原始碼或安裝檔，打開網頁點擊右上角「**安裝桌面版**」，即可在 Windows（Chrome/Edge）或 Mac（Safari 加入 Dock）安裝為獨立桌面 App，支援離線開啟。
4. **本地優先（Local-First）＋ Google Drive 自動背景同步**：平常讀寫 100% 在本機 IndexedDB 毫秒級完成；連結個人 Google Drive 後，有網路時自動於背景雙向合併同步（支援多裝置 Last-Write-Wins 與刪除墓碑防呆），跨電腦與手機無縫接軌。
5. **雙模式地圖分享（網址直連 ／ Google Drive 雲端）**：
   - **方案 B（網址直接分享）**：透過原生 Deflate 演算法將地圖壓縮進網址（`#/share?data=...`），免登入點開即看，並可一鍵「儲存至我的地圖庫」。
   - **方案 A（Google Drive 雲端分享）**：將包含 30+ 節點完整長篇教材的地圖上傳至個人 Google Drive 並產出分享連結（`#/share?gdrive=...`），容量不受網址長度限制。
6. **BYOK 透明與多元連線**：支援 OpenAI、Anthropic、Google Gemini、DeepSeek、OpenRouter、本地 Ollama 或自訂 OpenAI 相容端點，並支援一鍵拉取線上可用模型清單。
7. **全方位格式匯出**：支援單一獨立 HTML 互動手冊（含樹狀導覽與完整筆記、支援列印 PDF）、Markdown 筆記、心智圖標準 OPML，以及完整 `.mapcraft.json` 備份。

---

## 為什麼選擇 MapCraft？（與市面心智圖工具對比）

| 比較維度 | 市面傳統心智圖（XMind 等） | 市面新興 AI 心智圖 | **MapCraft（地圖工坊）** |
| :--- | :--- | :--- | :--- |
| **本質定位** | 繪圖與排版工具（整理已知思維） | 一次性文字發想工具 | **心智圖即完整教材**（個人化 AI 導師導航） |
| **節點深度** | 節點僅有文字標題，點開多為空 | 僅生成下層小標題，無實質教材 | **引導式自由教學**（比喻/表格/圖解/實戰/隨堂測驗） |
| **前後脈絡知覺** | 無前後依賴概念，各節點彼此孤立 | Prompt 容易內容重複或偏離主題 | **全路徑上下文傳遞**（感知先備知識，禁超前專有名詞轟炸） |
| **商業模式** | 買斷或軟體訂閱制 | 昂貴月費制（$10~$20 USD/月） | **100% 免費開源 · 零後端 · BYOK 自備金鑰** |
| **跨裝置與分享** | 需購買官方雲端空間或手動傳檔 | 綁定廠商私有雲端帳號 | **Local-First 自動同步個人 Google Drive ＋ 網址直接分享** |
| **桌面安裝體驗** | 需下載肥大安裝包 | 僅限網頁瀏覽 | **內建 PWA 支援 Windows / Mac 一鍵安裝為獨立桌面 App** |
| **隱私與安全** | 存在專有格式或廠商伺服器 | 發想與金鑰經第三方代理轉發 | **零後端伺服器**（金鑰直連官方端點，資料存本機與個人雲端） |
| **生態匯出相容** | 專有私有格式綁定 | 匯出格式有限，大多需付費升級 | **單檔 HTML 互動手冊、Markdown、通用 OPML、JSON** |

---

## 一般使用者如何使用與安裝桌面版？

一般使用者**不需要**下載 GitHub 原始碼或執行任何指令：

1. 直接用瀏覽器打開線上版網址：[https://Lin-Yu-kuan.github.io/mapCraft/](https://Lin-Yu-kuan.github.io/mapCraft/)
2. **安裝為電腦桌面 App（選用）**：
   - **Windows (Chrome / Edge)**：點擊網頁右上角「**安裝桌面版**」，1 秒即可將 MapCraft 釘選至桌面與開始功能表，以無網址列的獨立視窗執行。
   - **Mac (Safari)**：點擊網頁右上角「**安裝桌面版**」查看指引，或點選頂部選單列「**檔案**」→「**加入 Dock**」。
3. **跨裝置雲端同步（選用）**：至「設定」頁面的「Google Drive 雲端同步」區塊連結您的 Google 帳號，即可開啟自動背景同步。

---

## 隱私與安全聲明

- **零後端伺服器**：MapCraft 站方無任何後端伺服器與資料庫，不收集、不上傳亦不分析任何使用者資料。
- **金鑰絕對安全**：您的 LLM API Key 與 Google Drive Token 僅儲存於您本機的瀏覽器 Storage 中（可選 LocalStorage、SessionStorage 或僅記憶體），發送請求時直接連線至官方端點，且匯出檔與分享網址皆經嚴格正則掃描與 `redact()` 遮罩保護，絕不外洩金鑰。
- **Google Drive 最小權限原則**：雲端同步僅使用 `drive.file` 範圍，只會存取 MapCraft 自身建立的 `MapCraft` 資料夾，絕不讀取您雲端硬碟中的其他私人檔案。
- **CSP 規範說明**：因本專案採 BYOK 架構，使用者可自行設定任意合法的 Base URL（或公司內部 Gateway），因此 Content-Security-Policy 的 `connect-src` 允許 `https:` 及本地 Ollama（`http://localhost:*`、`http://127.0.0.1:*`）。

---

## 開發者如何自架 / 本地開發

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

建置完成後，將 `dist/` 目錄下的所有檔案發布至任何靜態託管平台（GitHub Pages、Cloudflare Pages、Vercel、S3、Nginx）即可。  
本專案已內建 `.github/workflows/deploy.yml`，推送至 `main` 分支即自動執行品質檢查並部署至 GitHub Pages。

---

## 程式碼品質與測試

本專案遵循嚴格的自動化檢驗與架構邊界檢查：

```bash
# 執行所有檢查（ESLint 模組邊界 + TypeScript 嚴格型別 + Vitest 單元/整合測試）
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

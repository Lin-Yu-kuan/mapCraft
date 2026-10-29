# MapCraft 架構與程式碼全景圖（CODEGRAPH）

本文檔為 MapCraft 的程式碼與架構關係圖，嚴格對應專案的工程分層原則（`App → Features → Domain → Lib → Shared`）與模組職責。

---

## 1. 系統分層架構全景（Clean Architecture & Module Boundaries）

```mermaid
graph TD
    classDef app fill:#f87171,stroke:#b91c1c,color:#fff,stroke-width:2px;
    classDef features fill:#fbbf24,stroke:#d97706,color:#000,stroke-width:2px;
    classDef domain fill:#34d399,stroke:#059669,color:#000,stroke-width:2px;
    classDef lib fill:#60a5fa,stroke:#2563eb,color:#fff,stroke-width:2px;
    classDef shared fill:#a78bfa,stroke:#7c3aed,color:#fff,stroke-width:2px;

    subgraph AppLayer ["應用進入點與佈局 (src/app/)"]
        AppRouter["router.tsx<br/>HashRouter & OAuth 攔截"]:::app
        Layout["layout/Layout.tsx"]:::app
        TopBar["layout/TopBar.tsx<br/>PWA 安裝 / 雲端同步燈號"]:::app
    end

    subgraph FeaturesLayer ["功能模組 (src/features/)"]
        GenFeature["generation/<br/>HomePage & useGenerateMap"]:::features
        MapFeature["map/<br/>MapPage, MapCanvas, ShareMapModal"]:::features
        LessonFeature["lesson/<br/>LessonDrawer & useLesson"]:::features
        LibFeature["library/<br/>LibraryPage"]:::features
        SettingsFeature["settings/<br/>SettingsPage"]:::features
        SharedMapFeature["map/<br/>SharedMapPage (預覽與轉存)"]:::features
    end

    subgraph DomainLayer ["純業務邏輯層 (src/domain/) - 零依賴/純函式"]
        DomainTypes["types.ts & schemas.ts<br/>Zod 契約 / 型別定義"]:::domain
        TreeLogic["tree.ts & layout.ts<br/>樹狀階層 / D3 佈局計算"]:::domain
        ShareLogic["share.ts<br/>原生 Deflate 壓縮編解碼"]:::domain
        SyncLogic["sync.ts<br/>LWW 雙向合併與刪除墓碑"]:::domain
        Prompts["prompts/<br/>map, lesson.v2, brainstorm"]:::domain
        Exports["export/<br/>html, markdown, opml"]:::domain
    end

    subgraph LibLayer ["基礎設施與外部整合 (src/lib/)"]
        DB["db/<br/>Dexie IndexedDB (唯一真相來源)"]:::lib
        LLM["llm/<br/>OpenAI, Anthropic, Gemini, Ollama"]:::lib
        Cloud["cloud/<br/>GoogleDrive API & SyncManager"]:::lib
        Storage["storage/<br/>keys.ts, settings.ts, backup.ts"]:::lib
        I18n["i18n/<br/>zh-TW.json, en.json"]:::lib
    end

    subgraph SharedLayer ["通用元件與公用庫 (src/shared/)"]
        SafeMD["components/SafeMarkdown.tsx"]:::shared
        PwaHook["hooks/usePwaInstall.ts"]:::shared
    end

    %% 依賴流向 (由上至下，禁止反向依賴)
    AppRouter --> Layout
    Layout --> TopBar
    Layout --> GenFeature
    Layout --> MapFeature
    Layout --> LibFeature
    Layout --> SettingsFeature
    Layout --> SharedMapFeature

    MapFeature --> LessonFeature
    MapFeature --> ShareLogic
    MapFeature --> TreeLogic

    GenFeature --> LLM
    GenFeature --> Prompts
    GenFeature --> DB

    LessonFeature --> LLM
    LessonFeature --> Prompts
    LessonFeature --> SafeMD

    LibFeature --> DB
    LibFeature --> Storage

    SettingsFeature --> LLM
    SettingsFeature --> Cloud
    SettingsFeature --> Storage

    Cloud --> SyncLogic
    Cloud --> DB
    Cloud --> Storage

    TopBar --> PwaHook
    TopBar --> Cloud
```

---

## 2. 核心資料流與三大流程圖

### A. 本地優先（Local-First）與 Google Drive 背景同步流程

```mermaid
sequenceDiagram
    autonumber
    actor User as 使用者操作 (如：完成節點/新增地圖)
    participant UI as 頁面元件 (MapPage / LessonDrawer)
    participant Repo as 本地儲存庫 (mapsRepo / progressRepo)
    participant Dexie as 本機 IndexedDB (毫秒級完成)
    participant SyncMgr as CloudSyncManager (防抖引擎)
    participant GDrive as Google Drive (MapCraft/ 資料夾)

    User->>UI: 點選節點「標記為已完成」
    UI->>Repo: progressRepo.save(...)
    Repo->>Dexie: 寫入本機資料庫 (即時持久化)
    Dexie-->>UI: 狀態更新成功 (UI 立即打勾變色，零卡頓)
    Repo->>SyncMgr: notifyLocalMutation() (背景非同步觸發)

    Note over SyncMgr: 進入 2.5 秒防抖階段 (Debounce)<br/>檢查網路狀態 (navigator.onLine)

    alt 離線狀態 (!navigator.onLine)
        SyncMgr-->>UI: 標記為「離線待同步」
        Note over SyncMgr: 監聽 window.online 事件，連線後自動續傳
    else 線上狀態 (Online)
        SyncMgr->>GDrive: 下載遠端 mapcraft_cloud_sync.mapcraft.json
        SyncMgr->>SyncMgr: 執行 mergeSyncData() (LWW + 墓碑比對)
        SyncMgr->>Dexie: 原子寫入合併結果 (Transaction)
        SyncMgr->>GDrive: 上傳最新合併 BackupData
        SyncMgr-->>UI: 派發 'mapcraft:cloud-synced' 並更新 TopBar 狀態為「已同步」
    end
```

---

### B. 雙軌地圖分享流程（方案 A 雲端分享 vs 方案 B 網址直接分享）

```mermaid
flowchart TD
    Start([點擊「分享地圖」開啟 ShareMapModal]) --> Choose{選擇分享模式}

    %% 方案 B
    Choose -->|方案 B: 網址直接分享| Enc[使用原生 CompressionStream 進行 Deflate 壓縮]
    Enc --> CheckSize{是否超過 14,000 字元?}
    CheckSize -->|否: 容量允許| FullPayload[包含地圖骨架 + 完整深度筆記教材]
    CheckSize -->|是: 避免網址過長| SkeletonPayload[自動降級為: 地圖骨架 + 進度]
    FullPayload --> BuildUrl[組合 #/share?data=z.xxx 網址]
    SkeletonPayload --> BuildUrl
    BuildUrl --> CopyB[一鍵複製分享連結]

    %% 方案 A
    Choose -->|方案 A: Google Drive 雲端分享| CheckAuth{是否已連結 Google Drive?}
    CheckAuth -->|未連結| GoSettings[引導至設定頁授權 Google 帳號]
    CheckAuth -->|已連結| UploadGDrive[上傳 mapcraft_shared_ID.json 至 MapCraft 資料夾]
    UploadGDrive --> SetPublic[呼叫 Permissions API 設定任何人公開唯讀]
    SetPublic --> GenDriveLink[產出 #/share?gdrive=FileID 連結]
    GenDriveLink --> CopyA[一鍵複製雲端分享網址]

    %% 接收端
    CopyB & CopyA --> Recipient([好友/其他人打開分享連結])
    Recipient --> PreviewPage[進入 SharedMapPage 線上預覽]
    PreviewPage --> ReadOnlyCanvas[互動探索畫布、點閱隨附筆記與測驗]
    ReadOnlyCanvas --> SaveAction[點擊「＋ 儲存至我的地圖庫」]
    SaveAction --> ImportLocal[呼叫 saveSharedPayloadToLocal 自動分配唯一 ID 存入本機]
    ImportLocal --> Done([開始自主學習追蹤])
```

---

### C. 節點引導式自由教學（v2）生成與快取決策流

```mermaid
flowchart TD
    ClickNode([使用者在畫布點擊節點]) --> CheckCache{本機 Dexie 是否已有快取?}
    
    CheckCache -->|已有快取| RenderCache[0 成本毫秒直出，安全渲染 SafeMarkdown]
    
    CheckCache -->|無快取| CheckKey{是否已設定 API Key / Ollama?}
    CheckKey -->|未設定| ShowMissingKey[彈出提示引導至「設定」頁面]
    CheckKey -->|已設定| CheckOrder{是否開啟順序學習模式?}
    
    CheckOrder -->|有前置未學| WarnPrereq[顯示「前置節點尚未生成筆記」提醒橫幅]
    WarnPrereq --> SwitchCancel{若使用者切換其他節點?}
    SwitchCancel -->|切換| AutoClear[自動清除該警告橫幅，不殘留]
    
    CheckOrder -->|前置已完成或確認繼續| CallLLM[呼叫 lib/llm 生成 lesson.zh-TW.v2 請求]
    CallLLM --> ContextRule[上下文約束: 僅傳遞路徑祖先資訊，禁超前專有名詞]
    ContextRule --> ParseJSON[抽取修復 JSON 並經 LessonContentSchema 驗證]
    
    ParseJSON --> SaveDexie[存入 Dexie.lessons 並觸發背景同步通知]
    SaveDexie --> RenderLesson[渲染引導式 Markdown + 互動式隨堂測驗]
```

---

## 3. 模組職責對照索引表

| 模組目錄 | 核心檔案 | 職責說明 | 依賴約束 |
| :--- | :--- | :--- | :--- |
| `src/domain/` | `tree.ts`, `layout.ts`, `share.ts`, `sync.ts` | **純運算層**：階層演算法、座標配置、壓縮編解碼、LWW 合併。 | 純 TypeScript，嚴禁 import React、DOM 或網路庫。 |
| `src/domain/prompts/` | `map.zh-TW.ts`, `lesson.zh-TW.ts` | **提示詞契約**：定義 AI 的 Prompt 語境、結構格式與安全邊界。 | 僅匯出函式與字串常數。 |
| `src/lib/cloud/` | `googleDrive.ts`, `syncManager.ts`, `useCloudSync.ts` | **雲端基礎設施**：Google REST API v3、OAuth 彈窗擷取、背景防抖定時器。 | 可使用 `fetch`，金鑰與 Token 需經 `redact()` 遮罩。 |
| `src/lib/db/` | `db.ts`, `repos/*.ts` | **本機資料庫**：Dexie (IndexedDB) 封裝，作為應用程式唯一真相來源。 | 不存放明文 API Key。 |
| `src/lib/storage/` | `keys.ts`, `settings.ts`, `backup.ts` | **識別字凍結與安全儲存**：三模式 Storage 管理與 JSON 備份匯入匯出。 | 嚴格防禦敏感金鑰外洩。 |
| `src/features/` | `generation/`, `map/`, `lesson/`, `library/`, `settings/` | **業務元件與狀態**：畫布繪製、抽屜展示、設定管理與分享互動。 | 遵循四態（Loading / Empty / Error / Success），禁止直接呼叫 `fetch`。 |
| `src/shared/` | `SafeMarkdown.tsx`, `usePwaInstall.ts` | **共用原子功能**：XSS 白名單消毒 Markdown 渲染、PWA 桌面安裝監聽。 | 僅可依賴 domain 或 shared。 |


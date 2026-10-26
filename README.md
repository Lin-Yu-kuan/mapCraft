# MapCraft（地圖工坊）

> *AI drafts the map. You craft the learning.*（AI 起稿，你來完成。）

純前端、零後端、BYOK（自備金鑰）的心智圖 AI 學習網站：輸入主題 → LLM 產生 JSON 樹狀學習地圖 → 互動畫布 → 點節點生成教材 → 進度追蹤 → 本機儲存。

## 隱私與安全聲明

- **純前端零後端**：所有資料皆儲存於使用者瀏覽器本機（IndexedDB / Storage），站方無任何伺服器儲存使用者學習紀錄。
- **金鑰不外流**：API Key 僅存在您的瀏覽器中，直接由本機發送至您指定的 LLM 供應商 Base URL，絕不會上傳至任何第三方伺服器。

## 如何自架 / 本地開發

```bash
# 安裝相依套件
pnpm install

# 啟動本機開發伺服器
pnpm dev

# 驗證檢查 (Lint + Typecheck + Test)
pnpm check

# 建置靜態產物
pnpm build
```

## 授權條款

MIT License

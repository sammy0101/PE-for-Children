# 小朋友工作紙練習本（iPad 離線手寫 PWA）

免費、免伺服器、專為 **iPad（Safari / 加入主畫面獨立 App）** 設計的兒童工作紙練習工具。支援拍照掃瞄紙本題目、抹除既有答案、無限次手寫練習與一鍵清除重練。

---

## 核心功能

1. **拍照掃瞄與影像增強**
   - 直接呼叫 iPad 相機拍照或從相簿／檔案選取工作紙圖片。
   - 支援 **90° 旋轉**與 **高對比黑白掃瞄濾鏡**（抑制陰影、保留清晰題目線條）。

2. **底圖整理模式（抹除紙本原有答案）**
   - 針對「原本已印有或寫有答案」的工作紙，可於掃瞄預覽或清單卡片點選 **「整理底圖」**。
   - 提供 **塗白筆刷（細／中／粗）**、**矩形框選塗白**、**吸取紙張背景色**與 **上一步（Undo）**。
   - 支援「更新此工作紙底圖」或「另存新空白工作紙」。

3. **雙層分離手寫與重複練習**
   - **底圖與手寫圖層完全隔離**：練習時的局部橡皮擦與「一鍵清除全部手寫（附確認對話框）」絕不會抹掉題目底圖。
   - 筆跡採用 `[0, 1]` 正規化座標儲存，旋轉 iPad 螢幕或縮放畫布（75%–200%）皆能精準對齊。
   - 支援 4 種筆色（黑／藍／紅／綠）、粗細切換、局部橡皮擦與上一步（Undo）。

4. **Apple Pencil 防誤觸（Palm Rejection）**
   - 練習模式可切換 **「僅 Pencil（防誤觸開）」**，開啟後僅接受 `pointerType === 'pen'`，手掌靠在螢幕上也不會誤畫。

5. **完全離線與本機備份**
   - 透過 PWA（Service Worker）離線快取靜態資源，所有工作紙與筆跡皆儲存於 iPad 本機 **IndexedDB**，無須後端伺服器，保護家庭隱私。
   - 支援匯出／匯入完整 `.json` 備份檔。

---

## 本機開發與測試

> 需求環境：Node.js 20+

```bash
# 1. 安裝相依套件
npm install

# 2. 啟動本機開發伺服器
npm run dev

# 3. 執行型別檢查、單元測試與正式打包
npm run typecheck
npm test
npm run build
```

---

## 部署至 Vercel（免費 Hobby 方案）

專案已內建 `vercel.json`（含 PWA 的 `sw.js`、`manifest.webmanifest` 快取控制與安全性標頭）：

1. 將專案推送至 GitHub（Public 或 Private 皆可）。
2. 前往 [vercel.com](https://vercel.com) 登入後選擇 **Add New... → Project** 並匯入該 Repository。
3. Framework Preset 保持 **Vite**（Build Command: `npm run build`、Output Directory: `dist`），點擊 **Deploy**。

---

## 在 iPad 上安裝為獨立 App（強烈建議）

1. 使用 iPad **Safari** 開啟部署後的 HTTPS 網址。
2. 點選網址列旁的 **分享按鈕** → **「加入主畫面」**。
3. 從 iPad 桌面圖示開啟：
   - 進入無網址列的全螢幕練習模式。
   - 離線環境（如飛航模式）仍可開啟與書寫。
   - 可豁免一般 Safari 分頁 7 天未互動自動清除 IndexedDB 資料的限制。

---

## 專案結構

```text
├── GLOSSARY.md                  # 領域詞彙定義
├── index.html                   # 入口 HTML 與 iPad Web App Meta
├── package.json
├── tsconfig.json                # 嚴格 TypeScript 設定
├── vercel.json                  # Vercel PWA 快取與安全性標頭設定
├── vite.config.ts               # Vite + vite-plugin-pwa 設定
├── vitest.config.ts             # Vitest 單元測試設定
├── public/
│   └── icon.svg                 # App 圖示
├── src/
│   ├── main.ts
│   ├── styles.css
│   ├── domain/
│   │   ├── types.ts             # 強型別模型與 Result/assertNever
│   │   ├── inkEngine.ts         # 正規化筆跡引擎與雙層渲染
│   │   ├── scanProcessor.ts     # 圖片旋轉、縮放與高對比掃瞄濾鏡
│   │   └── whiteoutEngine.ts    # 底圖塗白遮罩渲染與合成烘焙
│   ├── storage/
│   │   ├── backupCodec.ts       # JSON 備份結構驗證與編解碼
│   │   └── worksheetRepo.ts     # IndexedDB 讀寫倉儲
│   └── ui/
│       ├── canvasController.ts  # 練習畫布指標輸入與防誤觸狀態機
│       ├── cleanupController.ts # 底圖整理塗改工具狀態機
│       └── app.ts               # 頁面流程與 DOM 事件綁定
└── tests/
    ├── backupCodec.test.ts
    ├── canvasController.test.ts
    ├── cleanupController.test.ts
    ├── inkEngine.test.ts
    ├── scanProcessor.test.ts
    ├── whiteoutEngine.test.ts
    └── worksheetRepo.test.ts
```
```

---

### 推送更新

```bash
git add README.md
git commit -m "docs: add README with setup, Vercel deployment, and iPad PWA guide"
git push

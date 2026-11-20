# 領域詞彙表 (Domain Glossary)

- **Worksheet (`WorksheetRecord`)**: 單份練習工作紙，包含不可變的底圖 (`baseImageDataUrl`)、尺寸與所屬筆跡指令序列 (`inkCommands`)。
- **Ink Layer (手寫圖層)**: 疊加於工作紙底圖之上的透明 `<canvas>`，僅負責繪製與擦除 `InkCommand[]`。
- **NormalizedPoint**: 相對於工作紙顯示區域寬高的 `[0, 1]` 區間座標，避免螢幕旋轉或縮放造成錯位。
- **InkCommand**: 向量筆跡指令，分為 `pen`（實色筆畫）與 `erase`（`destination-out` 局部擦除）。
- **ScanFilterMode**: 掃瞄影像後處理模式，包含 `original`（原圖）與 `high-contrast`（去陰影黑白高對比）。
- **Palm Rejection (防手掌誤觸)**: 鎖定僅接受 `pointerType === 'pen'`（Apple Pencil）書寫，忽略手指與手掌接觸。
- **Base-Image Cleanup Mode (底圖整理模式)**: 專用於抹除紙本上既有的答案或塗鴉之獨立模式，避免小孩練習時誤擦題目。
- **WhiteoutCommand (底圖塗改指令)**: 底圖整理模式中產生的暫存塗白指令（`brush` 筆刷塗白或 `rect` 矩形框選遮白），按下儲存後才烘焙成新的 `baseImageDataUrl`。

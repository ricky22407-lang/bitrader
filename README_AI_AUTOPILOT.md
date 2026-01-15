# AI Autopilot 升級版（雙擊即用）

## 你會得到什麼
- **全自動 AI 模式**：不再只靠 RSI 固定策略，AI 會根據市場焦點與你的候選清單自動挑選、配置權重。
- **每小時/每日動態決策**：循環執行（預設每 60 分鐘），自動審核持倉並調整。
- **AI 市場分析可視化**：終端顯示【市場焦點/決策理由/補充】，並可擴充到通知。
- **Kill-Switch**（可選）：日內回撤、連虧筆數、流動性不足 → 暫停新開倉（審核/平倉照常）。
- **條件停損單**：提供 reduce-only 停損下單（最佳化 Binance/Bybit；其他交易所自動容錯）。

## 使用
1. 解壓縮本專案。
2. **第一次**：雙擊 `install.command`（自動建立 .venv 與安裝依賴）。
3. quick_start設定投入金額
4. test_openai_standalone.command 為測試openai是否正常運作
5. crypto工具為解除限制
之後直接雙擊 `autopilot.command` 即可。
start manager full全開操作/監控視窗
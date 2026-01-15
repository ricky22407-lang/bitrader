
# ChatGPT Strategy Bot — Final Complete

## 一鍵啟動（建議）
```bash
bash init_db.command
bash quick_start.command      # 快速設定（API/預算/槓桿/paper or live）
bash start_manager_full.command
```
這會在 3~4 個視窗中同時執行：
- **Autopilot**：掃描 → 技術面候選 → 交給 GPT 分配 → 下單（含餘額感知與縮倉重試）
- **Monitor**：每 60s 更新 → 階梯移動停損、TP、極端停損、近爆倉保護 → 記錄實現損益
- **Manager**：互動指令（`list / pnl / status / close all / close SYMBOL / close id`）
- **GPT Agent**：每小時審核持倉（`hold / adjust_stop / close`）並可發通知

## 自動挑選標的（“AI=交易員”的市場掃描）
- `discover.scan_all: true` 時，會從 **全市場 USDⓈ-M 永續**中，先挑成交額高的前 K 檔，再用策略評分產生候選，最後交由 **GPT** 決策與分配。

## 通知
- `notify.telegram` 或 `notify.email` 填妥即可接收：開倉成功/失敗、TP/止損/極端停損、AI 風控審核摘要、每日 09:00 報告。

## 每日報告（09:00 台北）
- `report.daily_enable: true` 時，建議用排程（macOS 可用 launchd 或手動開視窗跑）：
```bash
. .venv/bin/activate && python -m modules.reporter
```

## 常見問題
- Binance `-4109 inactive` → 啟用 USDⓈ-M Futures + API 勾選 Futures 權限 + 轉 USDT 至 Futures 錢包
- 預算顯示不正確 → 確保 `config.yaml` 只有**一個** `autopilot:` 區塊（此版已保證）
- 餘額不足 → Autopilot 會自動縮倉重試；同時建議 `budget_usdt` ≈ 可用 USDT 的 80%

祝交易順利，回撤受控！

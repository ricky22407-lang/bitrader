#!/bin/bash
# fix-perms.command — 一鍵解除權限 & 設定可執行
# 使用方式：把本檔案放在 install_run.command / run.command 的同一層資料夾，直接雙擊或在 Terminal 執行：
#   bash fix-perms.command
set -euo pipefail

# 進入此腳本所在資料夾
cd "$(dirname "$0")"

echo "[INFO] Working in: $(pwd)"

# 欲處理的目標清單（存在才處理）
targets=(
  "manager.command"
  "autopilot.command"
  "gpt_agent.command"
  "health.command"
  "init_db.command"
  "monitor.command"
  "apply_budget_mode_force.command"
  "test_openai_standalone.command"
  "binance_selfcheck.command"
  "apply_budget_mode_patch.command"
  "apply_budget_mode_force.command"
  "start_manager_full.command"
  "quick_start.command"
)

fixed_any=false

for f in "${targets[@]}"; do
  if [[ -e "$f" ]]; then
    echo "----------------------------------------"
    echo "[INFO] Found: $f"

    # 1) 移除 Gatekeeper 下載保護（若有）
    if xattr "$f" >/dev/null 2>&1; then
      if xattr -p com.apple.quarantine "$f" >/dev/null 2>&1; then
        echo "[INFO] Removing quarantine attribute..."
        xattr -d com.apple.quarantine "$f" || true
      fi
    fi

    # 2) 設定可執行權限
    echo "[INFO] Setting +x on $f ..."
    chmod +x "$f"

    # 3) 顯示最終權限
    ls -l "$f"
    fixed_any=true
  fi
done

if [[ "$fixed_any" == false ]]; then
  echo "[WARN] 沒有在目前資料夾找到以下任一檔案：install_run.command / run.command / run_command / install.command"
  echo "[HINT] 請確認你把 fix-perms.command 放在正確的資料夾，或手動指定： bash fix-perms.command"
  exit 1
fi

echo "----------------------------------------"
echo "[OK] 權限處理完成！你現在可以直接雙擊執行上述檔案。"

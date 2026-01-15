#!/bin/zsh
cd "$(dirname "$0")"
if [ ! -d ".venv" ]; then
  echo "第一次執行，先安裝依賴…"
  ./install.command
fi
source .venv/bin/activate
python -m modules.auto_trader_chatgpt
read -n 1 -s -r -p "按任意鍵關閉視窗…"

#!/bin/zsh
cd "$(dirname "$0")"
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
# macOS LibreSSL 下固定 urllib3 < 2，避免噪音警告
python - <<'PY'
import sys, subprocess
req = """ccxt>=4.3.0
pandas>=2.0.0
numpy>=1.26.0
PyYAML>=6.0.1
rich>=13.7.0
pytz>=2024.1
requests>=2.32.3
openai>=1.0.0
urllib3<2
"""
open('requirements.txt','w').write(req)
subprocess.check_call([sys.executable,'-m','pip','install','-r','requirements.txt'])
print("✅ 安裝完成，請雙擊 autopilot.command 開始執行")
PY

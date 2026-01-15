
#!/bin/bash
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"; cd "$DIR"
if [ ! -x "$DIR/.venv/bin/python" ]; then
  if command -v python3 >/dev/null 2>&1; then
    python3 -m venv .venv
    "$DIR/.venv/bin/pip" install -r requirements.txt || true
    if [ -f requirements.addon.txt ]; then "$DIR/.venv/bin/pip" install -r requirements.addon.txt || true; fi
  else
    echo "python3 not found"; exit 1
  fi
fi
exec "$DIR/.venv/bin/python" - <<'PY'
from modules.config import load_config
from modules.gpt_agent import gpt_review_positions
from modules.notifier import Notifier
from rich import print
from rich.panel import Panel
import time
cfg = load_config()
nt = Notifier(cfg)
iv = int((cfg.get("agent",{}) or {}).get("cadence_min",60))
print(Panel.fit(f"[bold cyan]GPT Agent[/bold cyan] every {iv} min", border_style="cyan"))
while True:
    data = gpt_review_positions(cfg)
    # 簡訊息：決策摘要
    decs = data.get("decisions", [])
    if decs:
        brief = "; ".join([f"#{d.get('id')} {d.get('action')}" for d in decs])
        nt.send("GPT 風控審核：" + brief)
    time.sleep(iv*60)
PY

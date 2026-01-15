
#!/bin/bash
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"; cd "$DIR"
if [ ! -x "$DIR/.venv/bin/python" ]; then
  if command -v python3 >/dev/null 2>&1; then
    python3 -m venv .venv
    "$DIR/.venv/bin/pip" install -r requirements.txt || true
  else
    echo "python3 not found"; exit 1
  fi
fi
exec "$DIR/.venv/bin/python" - <<'PY'
from modules.storage import init_db
from modules.config import load_config
cfg = load_config()
init_db(cfg["storage"]["db"])
print("DB initialized:", cfg["storage"]["db"])
PY

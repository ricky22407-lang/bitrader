#!/bin/zsh
# OpenAI 連線自我檢測（獨立版，雙擊即可，不依賴 modules/）
cd "$(dirname "$0")"

if [ ! -d ".venv" ]; then
  echo "第一次執行，先安裝依賴…"
  if [ -f "./install.command" ]; then
    ./install.command || { echo "❌ 安裝失敗"; read -n 1 -s -r -p "按任意鍵關閉視窗…"; exit 1; }
  else
    # 簡易安裝
    python3 -m venv .venv || { echo "❌ 建立虛擬環境失敗"; read -n 1 -s -r -p "按任意鍵關閉視窗…"; exit 1; }
    source .venv/bin/activate
    python -m pip install --upgrade pip
    python - <<'PY'
import sys, subprocess
req = "openai>=1.0.0\npyyaml>=6.0.1\nrequests>=2.32.3\n"
open('requirements_openai.txt','w').write(req)
subprocess.check_call([sys.executable,'-m','pip','install','-r','requirements_openai.txt'])
print("依賴安裝完成")
PY
  fi
fi

source .venv/bin/activate

python - <<'PY'
# -*- coding: utf-8 -*-
import os, json, sys
def panel(title: str, w: int = 68):
    print("╭" + "─"*w + "╮")
    print("│ " + title.center(w-2) + " │")
    print("╰" + "─"*w + "╯")

def load_cfg():
    try:
        import yaml
        with open("config.yaml","r",encoding="utf-8") as f:
            return yaml.safe_load(f) or {}
    except Exception:
        return {}

def get_key_and_model(cfg):
    key = ((cfg.get("openai") or {}).get("api_key") or
           os.environ.get("OPENAI_API_KEY") or "")
    model = ((cfg.get("openai") or {}).get("model") or "gpt-4o-mini")
    return key.strip(), model.strip()

def try_v1(key, model):
    try:
        import openai
        if hasattr(openai, "OpenAI"):
            client = openai.OpenAI(api_key=key)
            resp = client.chat.completions.create(
                model=model,
                messages=[
                    {"role":"system","content":"Return strictly JSON: {\"ok\":true}"},
                    {"role":"user","content":"say ok as JSON only"}
                ],
                temperature=0.0,
                max_tokens=10,
            )
            content = (resp.choices[0].message.content or "").strip()
            return True, content
    except Exception as e:
        return False, f"{type(e).__name__}: {e}"
    return False, "OpenAI v1 client not available"

def try_legacy(key, model):
    try:
        import openai
        if hasattr(openai, "ChatCompletion"):
            openai.api_key = key
            resp = openai.ChatCompletion.create(
                model=model,
                messages=[
                    {"role":"system","content":"Return strictly JSON: {\"ok\":true}"},
                    {"role":"user","content":"say ok as JSON only"}
                ],
                temperature=0.0,
                max_tokens=10,
            )
            content = (resp["choices"][0]["message"]["content"] or "").strip()
            return True, content
    except Exception as e:
        return False, f"{type(e).__name__}: {e}"
    return False, "OpenAI legacy client not available"

def main():
    panel("OpenAI 自我檢測（獨立版）")
    cfg = load_cfg()
    key, model = get_key_and_model(cfg)

    if not key:
        print("❌ 未找到 OpenAI 金鑰。請在 config.yaml 的 openai.api_key 填入，或設定環境變數 OPENAI_API_KEY。")
        sys.exit(2)

    print(f"模型：{model}")
    ok, msg = try_v1(key, model)
    if not ok and "model" in msg.lower():
        print(f"v1 模型錯誤，改用預設 gpt-4o-mini 重試…")
        ok, msg = try_v1(key, "gpt-4o-mini")

    if not ok:
        print(f"v1 嘗試失敗：{msg}")
        print("改用 legacy 介面重試…")
        ok, msg = try_legacy(key, model)
        if not ok and "model" in msg.lower():
            print("legacy 模型錯誤，改用預設 gpt-4o-mini 重試…")
            ok, msg = try_legacy(key, "gpt-4o-mini")

    if ok:
        try:
            parsed = json.loads(msg)
        except Exception:
            parsed = None
        print("\n✅ 連線成功！")
        if parsed is not None:
            print(f"模型輸出（JSON）：{parsed}")
        else:
            print(f"模型輸出：{msg}")
        sys.exit(0)
    else:
        print("\n❌ 連線失敗")
        print(msg)
        sys.exit(1)

if __name__ == "__main__":
    main()
PY

read -n 1 -s -r -p "按任意鍵關閉視窗…"

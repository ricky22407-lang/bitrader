# -*- coding: utf-8 -*-
"""
gpt_agent.py (AI 自動決策 + 滾動式調整 v2.0)
- **已擴展：** gpt_review_positions 支援 'scale_out' (減倉) 與 'scale_in' (加倉)
- **已優化：** 倉位調整指令 (Prompt)，以「最大化獲利，最小化損失」為目標。
- 有 OpenAI 金鑰：用 GPT 依市場焦點 + 候選清單做配置
- 無金鑰 / 連線錯誤 / 非 JSON 回覆：啟動「系統備援」(ccxt 依 24h 動能×成交額)
"""

import os, json, re, math, textwrap
from typing import Any, Dict, List, Tuple

# ---------------------------- helpers ----------------------------

def _safe_json_parse(txt: str) -> Dict[str, Any]:
    try:
        return json.loads(txt)
    except Exception:
        return {}

def _relaxed_json_parse(txt: str) -> Dict[str, Any]:
    """嘗試從非純 JSON 的文字中抽出 JSON（含 ```json ... ``` 或前後多餘文字）"""
    if not isinstance(txt, str) or not txt.strip():
        return {}
    s = txt.strip()
    # 去掉 ```json/``` fence
    m = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", s, flags=re.S)
    if m:
        try:
            return json.loads(m.group(1))
        except Exception:
            pass
    # 抓第一個 { 開始到最後一個 } 結束的區段
    i = s.find("{")
    j = s.rfind("}")
    if i != -1 and j != -1 and j > i:
        chunk = s[i:j+1]
        try:
            return json.loads(chunk)
        except Exception:
            # 常見：單引號、尾逗號
            chunk2 = re.sub(r"'", '\"', chunk)
            chunk2 = re.sub(r",\s*([}\]])", r"\1", chunk2)
            try:
                return json.loads(chunk2)
            except Exception:
                pass
    return {}

def _get_api_key(cfg: dict) -> str:
    return (
        (cfg.get("openai", {}) or {}).get("api_key")
        or os.environ.get("OPENAI_API_KEY")
        or ""
    )

def _fetch_market_headlines(max_items: int = 6) -> str:
    """Best-effort 市場焦點；過濾通用/導覽詞，失敗不拋例外"""
    banned = {"latest videos","latest crypto news","research","press releases","sponsored","most read","newsletters"}
    try:
        import requests
        url = "https://cryptopanic.com/api/v1/posts/"
        params = {"filter": "rising", "public": "true"}
        r = requests.get(url, params=params, timeout=6)
        if r.ok:
            rows = (r.json() or {}).get("results", [])[: max_items * 2]
            titles = []
            for it in rows:
                t = (it or {}).get("title") or ""
                t = re.sub(r"\s+", " ", t).strip()
                if not t:
                    continue
                low = t.lower()
                if any(k in low for k in banned):
                    continue
                if 6 <= len(t) <= 140:
                    titles.append(f"- {t}")
                if len(titles) >= max_items:
                    break
            if titles:
                return "\n".join(titles)
    except Exception:
        pass
    try:
        import requests
        html = requests.get("https://www.coindesk.com/", timeout=6).text
        cands = re.findall(r'<h[12][^>]*>(.*?)</h[12]>', html, flags=re.I)
        titles = []
        for raw in cands:
            t = re.sub("<[^<]+?>", "", raw).strip()
            if not t:
                continue
            low = t.lower()
            if any(k in low for k in banned):
                continue
            if 6 <= len(t) <= 140:
                titles.append(f"- {t}")
            if len(titles) >= max_items:
                break
        if titles:
            return "\n".join(titles)
    except Exception:
        pass
    return ""

def _extract_analysis_text(market_notes: str, parsed: Dict[str, Any], extra: str = "", llm_raw: str = "", llm_err: str = "") -> str:
    reason = (parsed.get("reason") or "").strip() if isinstance(parsed, dict) else ""
    notes  = (parsed.get("notes") or "").strip()  if isinstance(parsed, dict) else ""
    parts: List[str] = []
    if market_notes:
        parts.append("【市場焦點】\n" + market_notes)
    if reason:
        parts.append("【決策理由】\n" + reason)
    if notes:
        parts.append("【補充】\n" + notes)
    if extra:
        parts.append("【系統備援】\n" + extra.strip())
    # 若有備援或解析失敗，附上 LLM 訊息輔助除錯（截斷避免洗版）
    if extra or llm_err:
        snippet = (llm_raw or "").strip().replace("\r"," ")
        if len(snippet) > 600:
            snippet = snippet[:600] + "…"
        diag = "【LLM 回覆/原因】\n"
        if llm_err:
            diag += f"(error) {llm_err}\n"
        if snippet:
            diag += f"(raw) {snippet}"
        parts.append(diag.strip())
    return "\n\n".join([p for p in parts if p])

def _openai_chat(messages: List[Dict[str, str]], cfg: dict) -> Tuple[str, str]:
    """
    回傳 (content, error_message)。成功時 error_message 為空字串。
    """
    api_key = _get_api_key(cfg)
    if not api_key:
        return "", "no api key"
    try:
        import openai
    except Exception as e:
        return "", f"import openai failed: {e}"
    model = (cfg.get("openai", {}) or {}).get("model", "gpt-4o-mini")
    # 先試新版 v1
    try:
        if hasattr(openai, "OpenAI"):
            client = openai.OpenAI(api_key=api_key)
            resp = client.chat.completions.create(model=model, messages=messages, temperature=0.2, max_tokens=600)
            content = (resp.choices[0].message.content or "").strip()
            return content, ""
    except Exception as e:
        last_err = f"v1: {type(e).__name__}: {e}"
    else:
        last_err = "v1 client not available"
    # 再試 legacy
    try:
        if hasattr(openai, "ChatCompletion"):
            openai.api_key = api_key
            resp = openai.ChatCompletion.create(model=model, messages=messages, temperature=0.2, max_tokens=600)
            content = (resp["choices"][0]["message"]["content"] or "").strip()
            return content, ""
    except Exception as e:
        last_err = last_err + " | legacy: " + f"{type(e).__name__}: {e}"
    return "", last_err

def _normalize_picks(raw: Any) -> List[Dict[str, Any]]:
    """將模型或備援回傳的 picks 正規化為 list[dict]"""
    items: List[Any] = []
    if isinstance(raw, list):
        items = raw
    elif isinstance(raw, dict):
        items = [raw]
    else:
        return []
    norm: List[Dict[str, Any]] = []
    k = min(5, len(items)) or 1
    eq = round(1.0 / k, 6)
    for it in items:
        if isinstance(it, str):
            sym = it.strip().upper().replace("/", "")
            if sym:
                norm.append({"symbol": sym, "weight": eq, "side": "long"})
            continue
        if isinstance(it, dict):
            sym = str(it.get("symbol") or "").upper().replace("/", "")
            if not sym:
                continue
            try:
                w = float(it.get("weight", 0.0))
            except Exception:
                w = 0.0
            side = str(it.get("side") or "long").lower()
            if side not in ("long", "short"):
                side = "long"
            norm.append({"symbol": sym, "weight": max(0.0, w), "side": side})
    if norm and all(abs(x["weight"]) <= 1e-9 for x in norm):
        for i in range(len(norm)):
            norm[i]["weight"] = eq
    s = sum(x["weight"] for x in norm)
    if s > 1.0 and s > 0:
        for i in range(len(norm)):
            norm[i]["weight"] = round(norm[i]["weight"] / s, 6)
    return norm

# ---------------------------- market fallback ----------------------------

def _make_exchange(cfg):
    import ccxt
    exid = (cfg.get("exchange") or {}).get("id","binance")
    return getattr(ccxt, exid)({})

def _ticker_metrics(t: Dict[str, Any]) -> Tuple[float, float]:
    """return (pct_change, quote_volume_usd)"""
    pct = None
    qv = 0.0
    try:
        if t.get("percentage") is not None:
            pct = float(t["percentage"])
    except Exception:
        pct = None
    try:
        if t.get("quoteVolume") is not None:
            qv = float(t["quoteVolume"])
        elif t.get("baseVolume") is not None and t.get("last") is not None:
            qv = float(t["baseVolume"]) * float(t["last"])
    except Exception:
        qv = 0.0
    return (pct if pct is not None else 0.0, qv)

def _system_allocate(cfg: dict, candidates: List[str]) -> Tuple[List[Dict[str, Any]], str]:
    """
    用 24h 動能 + 成交額做排序，選出最多 3 檔，權重按分數比例分配。
    分數 = abs(24h%變動) * log10(1+成交額USD)
    回傳 (picks, extra_text)
    """
    picks: List[Dict[str, Any]] = []
    extra_lines: List[str] = []
    try:
        ex = _make_exchange(cfg)
        sym_norm = [s.replace("/", "") for s in candidates or []]
        scored = []
        for s in sym_norm[:20]:
            sym = s if s.endswith("USDT") else (s + "USDT")
            mkt = sym.replace("USDT", "/USDT")
            try:
                t = ex.fetch_ticker(mkt)
            except Exception:
                continue
            pct, qv = _ticker_metrics(t or {})
            score = abs(pct) * max(1.0, math.log10(1.0 + qv))
            scored.append((sym, pct, qv, score))
        scored.sort(key=lambda x: x[3], reverse=True)
        top = scored[:3]
        if not top:
            return [], "未取得有效市況資料，備援略過"
        total = sum(x[3] for x in top) or 1.0
        for sym, pct, qv, sc in top:
            w = round(sc / total, 6)
            picks.append({"symbol": sym, "weight": w, "side": "long" if pct >= 0 else "short"})
            extra_lines.append(f"{sym}: {pct:+.2f}% / 24h成交額≈{qv:,.0f} USD / w={w:.3f}")
        return picks, "依 24h 動能×成交額排序（分數=|%|×log10(1+成交額)）\n" + "\n".join(extra_lines)
    except Exception:
        return [], "備援異常；本輪略過"

# ---------------------------- public API ----------------------------

def gpt_rank_and_allocate(cfg: dict, *args, **kwargs) -> Dict[str, Any]:
    # 1) 市場焦點
    try:
        _h = _fetch_market_headlines()
        market_notes = ("市場最新焦點:\n" + _h + "\n") if _h else ""
    except Exception:
        market_notes = ""

    # 2) Prompt
    sys_prompt = (
        "你是嚴謹的加密貨幣交易助理。僅輸出 JSON，格式："
        '{"picks":[{"symbol":"BTCUSDT","weight":0.2,"side":"long"}],'
        '"reason":"<簡述為何這樣配置>"}'
    )
    candidates = kwargs.get("candidates") or kwargs.get("symbols") or []
    budget = kwargs.get("budget") or (cfg.get("budget_usdt") or (cfg.get("capital",{}) or {}).get("budget_usdt"))
    user_prompt = (
        (market_notes or "")
        + "請在可交易清單中挑選 1-5 個標的並給出權重（總和<=1）。\n"
        f"可交易清單: {candidates}\n"
        f"可用資金(USDT): {budget}\n"
        "請只輸出 JSON，不要多餘文字。"
    )

    # 3) 嘗試 GPT
    txt, err = _openai_chat(
        [{"role": "system", "content": sys_prompt},
         {"role": "user", "content": user_prompt}],
        cfg
    )
    data = _safe_json_parse(txt) or _relaxed_json_parse(txt) or {}
    picks = _normalize_picks(data.get("picks") if isinstance(data, dict) else [])

    # 4) 若 GPT 無回應或 picks 為空，啟動系統備援
    extra = ""
    if not picks:
        extra = f"GPT 未回覆或解析失敗，啟動系統備援。候選清單: {candidates}\n"
        picks, fallback_extra = _system_allocate(cfg, candidates)
        extra += fallback_extra

    # 5) 組合 analysis 並回傳（帶上 LLM 原文/錯誤摘要，方便判讀）
    analysis_text = _extract_analysis_text(market_notes, data, extra=extra, llm_raw=txt, llm_err=err)
    return {
        "analysis": analysis_text,
        "picks": picks,
        "reason": data.get("reason", "") if isinstance(data, dict) else ""
    }

# ---------------------------- 核心修改區域：支援滾動式調整 ----------------------------

def gpt_review_positions(cfg: dict, 
                         positions: List[Dict[str, Any]], 
                         current_market: Dict[str, Any], 
                         available_capital: float) -> Dict[str, Any]:
    """
    倉位檢視與滾動式調整。
    - 接收更多 context: current_market, available_capital。
    - 輸出支援: 'close', 'adjust_stop', 'scale_out', 'scale_in'。
    """
    if not positions:
        return {"decisions": [], "reason": "no open positions"}

    key = _get_api_key(cfg)
    if not key:
        return {"decisions": [], "reason": "no api key"}

    # --- 擴充 System Prompt 以包含新的 Action 與 風控指令 ---
    sys_prompt = (
        "你是專業的倉位風控與調整專家。你的核心目標是：在確保當前倉位安全的前提下，以「最大化浮動獲利，最小化潛在損失」的原則，執行精準的滾動式調整。"
        
        # 執行操作的明確要求
        "Action 僅允許 'close', 'adjust_stop', 'scale_out' 或 'scale_in'。"
        
        # 風控要求（最小化損失）
        "當 PnL% 為負數或市場出現劇烈拋售跡象時，你應優先考慮：1. 緊縮止損 (adjust_stop) 或 2. 完全平倉 (close) 以保存資金。"
        
        # 獲利要求（最大化獲利）
        "當 PnL% 為正數時，你應優先考慮：1. 執行部分減倉 (scale_out) 以鎖定利潤，或 2. 執行移動止損 (adjust_stop) 保護已實現的浮動獲利。"
        
        # 加倉邏輯
        "執行 'scale_in' 必須是極度看好且有充足可用資金時，應採用金字塔式加倉，避免在極高位追漲。"
        
        # 輸出格式約束
        "特別注意：'scale_out' 的 'reduce_ratio' 必須在 0.01 到 1.0 之間；'scale_in' 的 'capital_usd' 必須合理且小於可用資金。請在 'reason' 欄位簡述你的調整依據，並引用 PnL% 或市場快照數據。"
        "僅輸出 JSON，格式：{'decisions': [ ... ], 'reason': '<你的簡述>'}"
    )
    
    # --- 豐富 User Prompt 的資訊 (關鍵點) ---
    brief_positions = []
    for p in positions[:20]:
        # 假設您的主程式已經計算好 pnl_pct，並加入了 holding_time_sec (持倉時間秒數)
        brief_positions.append({
            "id": p.get("id"),
            "symbol": p.get("symbol"),
            "side": p.get("side"),
            "entry": p.get("entry"),
            "qty": p.get("qty"),
            "stop": p.get("stop"),
            "pnl_pct": p.get("pnl_pct", 0.0), # 浮動盈虧比例
            "holding_time_sec": p.get("holding_time_sec", 0), # 建議在主程式中加入
            "status": p.get("status"),
        })
    
    # 新增市場與資金資訊
    user_prompt_data = {
        "positions": brief_positions,
        "market_snapshot": current_market,
        "available_capital_usd": available_capital,
    }
    user_prompt = json.dumps(user_prompt_data, ensure_ascii=False, indent=2)

    txt, err = _openai_chat(
        [{"role": "system", "content": sys_prompt},
         {"role": "user", "content": user_prompt}],
        cfg
    )
    data = _safe_json_parse(txt) or _relaxed_json_parse(txt) or {}
    decisions = data.get("decisions", []) if isinstance(data, dict) else []
    
    # --- 關鍵：擴展解析邏輯以處理新的 Action ---
    clean: List[Dict[str, Any]] = []
    for d in (decisions if isinstance(decisions, list) else []):
        act = (d.get("action") or "").strip().lower() if isinstance(d, dict) else ""
        if act not in ("close", "adjust_stop", "scale_out", "scale_in"):
            continue
        
        item = {"id": (d.get("id") if isinstance(d, dict) else None), "action": act}
        
        # 處理 adjust_stop
        if act == "adjust_stop":
            try:
                ns = float(d.get("new_stop"))
                item["new_stop"] = ns
                clean.append(item)
            except Exception:
                continue
        
        # 處理 scale_out (部分平倉/減倉)
        elif act == "scale_out":
            try:
                # 必須指定減倉的比例 (0.01 < ratio <= 1.0)
                rr = float(d.get("reduce_ratio"))
                if 0.01 < rr <= 1.0:
                    item["reduce_ratio"] = rr
                    clean.append(item)
            except Exception:
                continue
                
        # 處理 scale_in (加倉)
        elif act == "scale_in":
            try:
                # 必須指定加倉的 USDT 金額
                cu = float(d.get("capital_usd"))
                # 簡單檢查：確保金額大於零
                if cu > 0.0: 
                    item["capital_usd"] = cu
                    clean.append(item)
            except Exception:
                continue
        
        # 處理 close (完全平倉)
        elif act == "close":
            clean.append(item)
            
    return {"decisions": clean, "reason": data.get("reason", "") if isinstance(data, dict) else ""}

# ---------------------------- (End of file) ----------------------------
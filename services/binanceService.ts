
import { Ticker, MarketContext, OrderBookStats } from "../types";

const BASE_URL = 'https://api.binance.com/api/v3';

// --- 1. Fetch Top Assets (The "Watchlist") ---
export const getTopVolatileAssets = async (limit: number = 6): Promise<string[]> => {
  try {
    const response = await fetch(`${BASE_URL}/ticker/24hr`);
    if (!response.ok) throw new Error("Binance API Error");
    const data = await response.json();

    // Filter for USDT pairs, exclude stablecoins/leverage tokens if possible
    // Sort by Quote Volume (active money flow)
    const topAssets = data
      .filter((t: any) => t.symbol.endsWith('USDT') && !['USDCUSDT', 'FDUSDUSDT', 'TUSDUSDT'].includes(t.symbol))
      .sort((a: any, b: any) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
      .slice(0, limit)
      .map((t: any) => t.symbol);

    // Ensure BTC and ETH are always in the list if not already
    if (!topAssets.includes('BTCUSDT')) topAssets[0] = 'BTCUSDT';
    
    return topAssets; // e.g. ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'PEPEUSDT', ...]
  } catch (e) {
    console.warn("Failed to fetch top assets, defaulting to BTC/ETH/SOL");
    return ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'DOGEUSDT', 'BNBUSDT'];
  }
};

// --- 2. Initial Data Fetch for a Specific Symbol ---
export const getInitialData = async (symbol: string): Promise<Ticker[]> => {
  try {
    const response = await fetch(`${BASE_URL}/klines?symbol=${symbol.replace('/','')}&interval=1m&limit=100`);
    if (!response.ok) throw new Error('Network response was not ok');
    const data = await response.json();
    return data.map((d: any) => ({
      symbol: symbol,
      time: Math.floor(d[0] / 1000),
      open: parseFloat(d[1]),
      high: parseFloat(d[2]),
      low: parseFloat(d[3]),
      close: parseFloat(d[4]),
      volume: parseFloat(d[5])
    }));
  } catch (error) {
    console.warn(`Failed to fetch history for ${symbol}`, error);
    return [];
  }
};

// --- 3. Multi-Stream Connection ---
export const connectBinanceMultiStream = (
  symbols: string[],
  onTick: (symbol: string, ticker: Ticker) => void,
  onError: (err: string) => void
) => {
  // Construct combined stream URL: btcusdt@kline_1m/ethusdt@kline_1m
  const streams = symbols.map(s => `${s.toLowerCase()}@kline_1m`).join('/');
  const wsUrl = `wss://stream.binance.com:9443/stream?streams=${streams}`;

  let socket: WebSocket | null = null;
  let isManuallyClosed = false;

  try {
    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log(`Connected to Multi-Stream: ${symbols.join(', ')}`);
    };

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        // Payload format: { stream: "btcusdt@kline_1m", data: { e: "kline", s: "BTCUSDT", k: {...} } }
        if (payload.data && payload.data.e === 'kline') {
          const k = payload.data.k;
          const symbol = payload.data.s; // e.g., BTCUSDT
          
          const ticker: Ticker = {
            symbol: symbol,
            time: Math.floor(k.t / 1000),
            open: parseFloat(k.o),
            high: parseFloat(k.h),
            low: parseFloat(k.l),
            close: parseFloat(k.c),
            volume: parseFloat(k.v)
          };
          onTick(symbol, ticker);
        }
      } catch (e) {
        // console.error('Parse Error', e);
      }
    };

    socket.onerror = (event) => {
      // Only report errors if we didn't intentionally close the socket
      if (!isManuallyClosed) {
         console.warn("Binance WebSocket Error:", event);
         onError('Binance WS Interrupted.');
      }
    };
    
    socket.onclose = () => {
        if (!isManuallyClosed) {
            console.log("Binance WS Closed unexpectedly");
        }
    };

  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    onError(`Failed to create WebSocket: ${errorMsg}`);
  }

  // Return cleanup function
  return () => {
    isManuallyClosed = true;
    if (socket) {
      socket.close();
      socket = null;
    }
  };
};


// --- Order Book (Existing) ---
const getOrderBookAnalysis = async (symbol: string): Promise<OrderBookStats> => {
    try {
        const response = await fetch(`${BASE_URL}/depth?symbol=${symbol.replace('/','')}&limit=50`);
        if (!response.ok) throw new Error("Depth fetch failed");
        
        const data = await response.json();
        const bids = data.bids;
        const asks = data.asks;

        let totalBidVol = 0;
        let totalAskVol = 0;

        bids.forEach((b: any) => totalBidVol += parseFloat(b[1]));
        asks.forEach((a: any) => totalAskVol += parseFloat(a[1]));

        const ratio = totalAskVol > 0 ? totalBidVol / totalAskVol : 1;
        const totalVol = totalBidVol + totalAskVol;
        const imbalancePct = totalVol > 0 ? (totalBidVol / totalVol) * 100 : 50;

        let dominant: 'BULLS' | 'BEARS' | 'NEUTRAL' = 'NEUTRAL';
        if (ratio > 1.2) dominant = 'BULLS';
        if (ratio < 0.8) dominant = 'BEARS';

        let wallPrice = undefined;
        const threshold = totalVol * 0.05;
        const askWall = asks.find((a: any) => parseFloat(a[1]) > threshold);
        if (askWall) wallPrice = parseFloat(askWall[0]);

        return {
            bidAskRatio: parseFloat(ratio.toFixed(2)),
            imbalancePct: parseFloat(imbalancePct.toFixed(1)),
            dominantSide: dominant,
            wallPrice
        };

    } catch (e) {
        return { bidAskRatio: 1, imbalancePct: 50, dominantSide: 'NEUTRAL' };
    }
};

export const getMarketContext = async (symbol: string): Promise<MarketContext> => {
  const s = symbol.replace('/', '');
  try {
    const [res15m, res1h, orderBook] = await Promise.all([
      fetch(`${BASE_URL}/klines?symbol=${s}&interval=15m&limit=50`),
      fetch(`${BASE_URL}/klines?symbol=${s}&interval=1h&limit=50`),
      getOrderBookAnalysis(s)
    ]);

    const parseData = async (res: Response) => {
      const data = await res.json();
      return data.map((d: any) => ({
        symbol: s,
        time: Math.floor(d[0] / 1000),
        open: parseFloat(d[1]),
        high: parseFloat(d[2]),
        low: parseFloat(d[3]),
        close: parseFloat(d[4]),
        volume: parseFloat(d[5])
      }));
    };

    return {
      tf1m: [], 
      tf15m: await parseData(res15m),
      tf1h: await parseData(res1h),
      orderBook 
    };
  } catch (error) {
    return { tf1m: [], tf15m: [], tf1h: [], orderBook: { bidAskRatio: 1, imbalancePct: 50, dominantSide: 'NEUTRAL' } };
  }
};

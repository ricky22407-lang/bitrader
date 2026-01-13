
import CryptoJS from 'crypto-js';

// Determine Base URL based on environment
// Safe access to process.env.NODE_ENV
const IS_DEV = process.env.NODE_ENV === 'development';
// NOTE: If using the "Allow CORS" extension, we can hit the API directly even in production
const BASE_URL = IS_DEV ? '/api/binance' : 'https://api.binance.com';

/**
 * Creates a query string with timestamp and signature
 */
const signQuery = (queryObj: Record<string, any>, secretKey: string) => {
  const timestamp = Date.now();
  const query = new URLSearchParams({ ...queryObj, timestamp: timestamp.toString() }).toString();
  const signature = CryptoJS.HmacSHA256(query, secretKey).toString(CryptoJS.enc.Hex);
  return `${query}&signature=${signature}`;
};

const handleApiError = async (response: Response) => {
    // Detect typical Browser Block (CORS)
    if (response.status === 0 || (response.status === 401 && response.type === 'opaque')) {
        throw new Error("CORS_BLOCK");
    }
    const text = await response.text();
    throw new Error(text);
};

/**
 * Fetches real USDT balance from Binance
 */
export const getRealBalance = async (apiKey: string, secretKey: string): Promise<number> => {
  if (!apiKey || !secretKey) {
    console.warn("Missing Binance API Keys for Real Balance");
    return 0;
  }

  try {
    const queryString = signQuery({}, secretKey);
    const response = await fetch(`${BASE_URL}/v3/account?${queryString}`, {
      method: 'GET',
      headers: { 
          'X-MBX-APIKEY': apiKey,
          // 'Content-Type': 'application/x-www-form-urlencoded' 
      }
    });

    if (!response.ok) await handleApiError(response);
    
    const data = await response.json();
    const usdtAsset = data.balances.find((b: any) => b.asset === 'USDT');
    return usdtAsset ? parseFloat(usdtAsset.free) : 0;
  } catch (error: any) {
    if (error.message === "CORS_BLOCK") {
        console.error("Browser blocked the request.");
        // We throw a specific code that the UI can catch to show the "Install Extension" toast
        throw new Error("CORS_BLOCK"); 
    }
    console.error("Real Balance Fetch Error:", error);
    return 0;
  }
};

/**
 * Executes a REAL Market Order on Binance
 */
export const executeRealBinanceOrder = async (
  symbol: string,
  side: 'BUY' | 'SELL',
  quantity: number, 
  isQuoteOrder: boolean = false,
  credentials: { apiKey: string, secretKey: string }
): Promise<{ filledPrice: number, executedQty: number, cost: number } | null> => {
  
  const { apiKey, secretKey } = credentials;

  if (!apiKey || !secretKey) {
    throw new Error("Missing Binance API Keys");
  }

  // Symbol format: BTCUSDT (remove slash)
  const formattedSymbol = symbol.replace('/', '').toUpperCase();

  const params: any = {
    symbol: formattedSymbol,
    side: side,
    type: 'MARKET',
  };

  if (side === 'BUY' && isQuoteOrder) {
    params.quoteOrderQty = quantity;
  } else {
    params.quantity = quantity;
  }

  try {
    const queryString = signQuery(params, secretKey);
    const response = await fetch(`${BASE_URL}/v3/order?${queryString}`, {
      method: 'POST',
      headers: { 'X-MBX-APIKEY': apiKey }
    });

    if (!response.ok) await handleApiError(response);

    const data = await response.json();
    
    // Calculate average filled price
    let totalCost = 0;
    let totalQty = 0;
    
    if (data.fills && data.fills.length > 0) {
      data.fills.forEach((fill: any) => {
        totalCost += parseFloat(fill.price) * parseFloat(fill.qty);
        totalQty += parseFloat(fill.qty);
      });
    } else {
      totalCost = parseFloat(data.cummulativeQuoteQty);
      totalQty = parseFloat(data.executedQty);
    }

    return {
      filledPrice: totalQty > 0 ? totalCost / totalQty : 0,
      executedQty: totalQty,
      cost: totalCost
    };

  } catch (error: any) {
    if (error.message === "CORS_BLOCK") {
        throw new Error("CORS_BLOCK");
    }
    console.error("Execute Real Order Error:", error);
    throw error;
  }
};

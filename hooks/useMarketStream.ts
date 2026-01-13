
import { useState, useEffect, useRef } from 'react';
import { Ticker, Trade } from '../types';
import { connectBinanceMultiStream, getTopVolatileAssets, getInitialData } from '../services/binanceService';
import { updateCurrentPrice, checkTradeTriggers } from '../services/exchangeService';

export const useMarketStream = (
  isRunning: boolean, 
  activeSymbol: string, // The symbol user/AI is currently looking at
  onTriggerHit: (trade: Trade) => void,
  onError: (msg: string) => void
) => {
  // Store full history for ALL watched symbols
  // structure: { "BTCUSDT": [tick1, tick2...], "ETHUSDT": [...] }
  const [marketMap, setMarketMap] = useState<Record<string, Ticker[]>>({});
  
  // The subset of tickers for the currently active symbol (for Chart)
  const [activeTickers, setActiveTickers] = useState<Ticker[]>([]);
  
  const [watchedSymbols, setWatchedSymbols] = useState<string[]>([]);
  const lastUpdateRef = useRef<number>(Date.now());

  // 1. Initial Setup: Get Top Movers & Bootstrap Data
  useEffect(() => {
    const initMarket = async () => {
      // Fetch top 6 volatile assets
      const topAssets = await getTopVolatileAssets(6);
      setWatchedSymbols(topAssets);
      
      // Fetch initial history for ALL of them (parallel)
      const initialDataMap: Record<string, Ticker[]> = {};
      await Promise.all(topAssets.map(async (sym) => {
         const hist = await getInitialData(sym);
         initialDataMap[sym] = hist;
      }));
      setMarketMap(initialDataMap);
    };
    initMarket();
  }, []); // Run once on mount

  // 2. Sync Active Tickers for UI Chart
  useEffect(() => {
    if (marketMap[activeSymbol]) {
        setActiveTickers(marketMap[activeSymbol]);
        
        // Update the global current price for position calculations
        const lastTick = marketMap[activeSymbol][marketMap[activeSymbol].length - 1];
        if (lastTick) {
            updateCurrentPrice(lastTick.close);
        }
    }
  }, [marketMap, activeSymbol]);

  // 3. Multi-Stream Connection
  useEffect(() => {
    if (watchedSymbols.length === 0) return;

    let cleanupWS: (() => void) | undefined;
    
    const establishConnection = () => {
        cleanupWS = connectBinanceMultiStream(
            watchedSymbols,
            async (symbol, newTicker) => {
                lastUpdateRef.current = Date.now();
                
                setMarketMap(prev => {
                    const prevHistory = prev[symbol] || [];
                    
                    // Dedupe logic (Binance sends updates for same candle)
                    const last = prevHistory[prevHistory.length - 1];
                    let updatedHistory;
                    
                    if (last && last.time === newTicker.time) {
                        updatedHistory = [...prevHistory];
                        updatedHistory[updatedHistory.length - 1] = newTicker;
                    } else {
                        updatedHistory = [...prevHistory, newTicker];
                    }
                    
                    // Limit memory
                    if (updatedHistory.length > 200) updatedHistory = updatedHistory.slice(-200);

                    return { ...prev, [symbol]: updatedHistory };
                });

                // Check Triggers ONLY if this ticker matches our active position symbol
                // Note: checkTradeTriggers uses global state, but it's good to call it often
                if (isRunning) {
                   const triggerTrade = await checkTradeTriggers(); 
                   if (triggerTrade) onTriggerHit(triggerTrade);
                }
            },
            (err) => onError(err)
        );
    };

    establishConnection();

    return () => {
        if (cleanupWS) cleanupWS();
    };
  }, [watchedSymbols, isRunning, onTriggerHit, onError]);

  return { activeTickers, marketMap, watchedSymbols };
};

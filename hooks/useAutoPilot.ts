
import { useState, useEffect, useRef, useCallback } from 'react';
import { BotConfig, Ticker, Portfolio, AnalysisReport, MarketSnapshot, UserSettings } from '../types';
import { calculateIndicators } from '../services/indicatorService';
import { executeOrder, setTradingMode, getPortfolio, checkCircuitBreaker } from '../services/exchangeService';
import { evaluateGlobalMarkets, conveneCouncil } from '../services/geminiService';
import { getMarketContext } from '../services/binanceService';
import { useKeepAlive } from './useKeepAlive';
import { sendTelegramMessage } from '../services/telegramService';

interface AutoPilotProps {
  isRunning: boolean;
  config: BotConfig;
  userSettings: UserSettings; // New prop
  marketMap: Record<string, Ticker[]>; 
  activeSymbol: string;
  setActiveSymbol: (sym: string) => void;
  portfolio: Portfolio;
  onLog: (type: any, message: string, metadata?: any) => void;
  onSpeak: (text: string) => void;
  refreshPortfolio: () => void;
}

export const useAutoPilot = ({
  isRunning,
  config,
  userSettings,
  marketMap,
  activeSymbol,
  setActiveSymbol,
  portfolio,
  onLog,
  onSpeak,
  refreshPortfolio
}: AutoPilotProps) => {
  
  const [reports, setReports] = useState<AnalysisReport[]>([]);
  const [currentStrategy, setCurrentStrategy] = useState<string>("Scanning...");
  const [nextCouncilTime, setNextCouncilTime] = useState<number>(0);
  const [currentPulse, setCurrentPulse] = useState<number>(config.maxPulse); 
  
  const lastCouncilCallRef = useRef<number>(0);
  const isCouncilProcessingRef = useRef<boolean>(false);
  const lastTickRef = useRef<number>(0);

  useEffect(() => {
    setTradingMode(config.tradingMode, userSettings.binanceApiKey, userSettings.binanceSecretKey);
  }, [config.tradingMode, userSettings]);

  const notifyTelegram = useCallback((msg: string) => {
      if (userSettings.telegramBotToken && userSettings.telegramChatId) {
          sendTelegramMessage(userSettings.telegramBotToken, userSettings.telegramChatId, `🤖 *AI Trader Notification*\n\n${msg}`);
      }
  }, [userSettings]);

  const executeStrategyCycle = useCallback(async (forced: boolean = false) => {
    if (!process.env.API_KEY) {
        if (forced) alert("Missing process.env.API_KEY");
        return;
    }
    
    const availableSymbols = Object.keys(marketMap);
    if (availableSymbols.length === 0) return;
    if (isCouncilProcessingRef.current) return;

    const coolDownRemaining = checkCircuitBreaker(portfolio);
    if (coolDownRemaining > 0 && !forced) return; 
    
    const now = Date.now();
    const activeInterval = forced ? 0 : currentPulse;
    if (!forced && now - lastCouncilCallRef.current < activeInterval) {
        setNextCouncilTime(lastCouncilCallRef.current + activeInterval);
        return;
    }

    isCouncilProcessingRef.current = true;

    try {
        const currentPortfolio = getPortfolio(); 

        // --- STEP 1: SCOUT ---
        const snapshots: MarketSnapshot[] = [];
        for (const sym of availableSymbols) {
            const ticks = marketMap[sym];
            if (ticks && ticks.length > 20) {
                const indicators = calculateIndicators(ticks);
                const last = ticks[ticks.length - 1];
                snapshots.push({
                    symbol: sym,
                    price: last.close,
                    rsi: indicators.rsi,
                    atr: indicators.atr,
                });
            }
        }

        let targetSymbol = activeSymbol;

        if (!forced) {
            onLog('INFO', `📡 Scanning ${snapshots.length} assets...`);
            const scanResult = await evaluateGlobalMarkets(snapshots, currentPortfolio, activeSymbol);

            onLog('SCOUT', `Pick: ${scanResult.selectedSymbol} [${scanResult.recommendedPath}] - ${scanResult.shortSummary}`);

            if (scanResult.selectedSymbol !== activeSymbol) {
                setActiveSymbol(scanResult.selectedSymbol);
                targetSymbol = scanResult.selectedSymbol;
                onSpeak(`Switching to ${scanResult.selectedSymbol.replace('USDT','')}.`);
                await new Promise(r => setTimeout(r, 500));
            }

            if (scanResult.marketCondition === 'BORING') {
                setCurrentPulse(config.maxPulse); 
                if (!forced && !scanResult.needsEscalation) {
                    lastCouncilCallRef.current = Date.now();
                    setNextCouncilTime(Date.now() + config.maxPulse);
                    isCouncilProcessingRef.current = false;
                    return; 
                }
            } else {
                setCurrentPulse(config.minPulse); 
            }
        }

        // --- STEP 2: COUNCIL ---
        const targetTickers = marketMap[targetSymbol] || [];
        if (targetTickers.length < 50) {
             isCouncilProcessingRef.current = false;
             return;
        }

        const indicators = calculateIndicators(targetTickers);
        const context = await getMarketContext(targetSymbol); 
        const recentHistory = currentPortfolio.tradeHistory
            .filter(t => t.pnl !== undefined)
            .slice(0, 5)
            .map(t => ({ type: (t.pnl || 0) > 0 ? 'WIN' as const : 'LOSS' as const, pnl: t.pnl || 0, reason: t.reason }));

        const decision = await conveneCouncil(
            targetTickers,
            currentPortfolio,
            indicators,
            { risk: config.riskLevel },
            context,
            recentHistory
        );

        setCurrentStrategy(`${decision.currentStrategy} (${decision.marketType})`);
        
        onLog('COUNCIL', decision.reasoning, { 
            confidence: decision.confidence,
            action: decision.action,
            path: decision.marketType,
            lev: decision.leverage
        });

        if (decision.report) setReports(prev => [decision.report!, ...prev]);

        // --- EXECUTION ---
        if (decision.action !== 'HOLD') {
            try {
                const trade = await executeOrder(
                    decision.action, 
                    decision.suggestedAmountPct || 0.5,
                    targetSymbol, 
                    decision.reasoning,
                    decision.stopLossPrice,
                    decision.takeProfitPrice,
                    decision.currentStrategy,
                    decision.trailingStopPct,
                    decision.marketType, // Pass the chosen path
                    decision.leverage // Pass the chosen leverage
                );
                
                if (trade) {
                    const levText = trade.marketType === 'FUTURES' ? `(${trade.leverage}x)` : '';
                    const tradeMsg = `${trade.side} ${trade.marketType} ${targetSymbol} ${levText}`;
                    onLog('TRADE', tradeMsg);
                    onSpeak(tradeMsg);
                    notifyTelegram(`✅ **EXECUTED**: ${tradeMsg}\nPrice: ${trade.price}\nReason: ${decision.reasoning}`);
                    refreshPortfolio(); 
                }
            } catch (err: any) {
                 onLog('ERROR', `Execution: ${err.message}`);
                 notifyTelegram(`❌ **ERROR**: Execution failed for ${targetSymbol}\n${err.message}`);
            }
        }

        lastCouncilCallRef.current = Date.now();
        setNextCouncilTime(Date.now() + currentPulse);

    } catch (error: any) {
        onLog('ERROR', `Strategy Loop: ${error.message}`);
    } finally {
        isCouncilProcessingRef.current = false;
    }
  }, [config, marketMap, activeSymbol, onLog, onSpeak, refreshPortfolio, currentPulse, portfolio, setActiveSymbol, userSettings, notifyTelegram]);

  const handleTick = useCallback(() => {
      const now = Date.now();
      if (now - lastTickRef.current > 1000) {
          executeStrategyCycle(false);
          lastTickRef.current = now;
      }
  }, [executeStrategyCycle]);

  const { isEngineActive } = useKeepAlive(isRunning, handleTick);

  return {
    reports,
    currentStrategy,
    nextCouncilTime,
    isEngineActive,
    forceScan: () => executeStrategyCycle(true),
    currentPulse
  };
};

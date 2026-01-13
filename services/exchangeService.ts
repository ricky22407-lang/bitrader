
import { Portfolio, Trade, BotConfig, Position, EquitySnapshot } from "../types";
import { saveToDB, loadFromDB } from "./db";
import { executeRealBinanceOrder, getRealBalance } from "./tradeExecutor";

// In-Memory State
let portfolio: Portfolio = {
  id: 1,
  balance: 10000,
  equity: 10000,
  spotPositions: [],
  futuresPositions: [],
  tradeHistory: [],
  equityHistory: [],
  lastUpdated: Date.now()
};

let currentPrice = 0;
let tradingMode: 'SIMULATION' | 'REAL_MONEY' = 'SIMULATION';
let binanceKey = '';
let binanceSecret = '';
let lastSnapshotTime = 0;

// NEW: Circuit Breaker Constants
const MAX_CONSECUTIVE_LOSSES = 3;
const COOL_DOWN_PERIOD_MS = 60 * 60 * 1000; // 1 Hour

export const checkCircuitBreaker = (pf: Portfolio): number => {
    if (pf.circuitBreakerTriggered) {
        const timePassed = Date.now() - pf.circuitBreakerTriggered;
        if (timePassed < COOL_DOWN_PERIOD_MS) {
            return COOL_DOWN_PERIOD_MS - timePassed; 
        } else {
            pf.circuitBreakerTriggered = undefined;
            savePortfolioState();
            return 0;
        }
    }

    const closedTrades = pf.tradeHistory.filter(t => t.pnl !== undefined);
    if (closedTrades.length < MAX_CONSECUTIVE_LOSSES) return 0;

    const recent = closedTrades.slice(0, MAX_CONSECUTIVE_LOSSES);
    const allLosses = recent.every(t => (t.pnl || 0) < 0);

    if (allLosses) {
        pf.circuitBreakerTriggered = Date.now();
        savePortfolioState();
        return COOL_DOWN_PERIOD_MS;
    }

    return 0;
};

// --- Configuration ---
export const setTradingMode = (mode: 'SIMULATION' | 'REAL_MONEY', key?: string, secret?: string) => {
  tradingMode = mode;
  if (key) binanceKey = key;
  if (secret) binanceSecret = secret;

  if (mode === 'REAL_MONEY' && binanceKey && binanceSecret) {
    syncRealBalance();
  }
};

export const syncRealBalance = async () => {
  if (tradingMode !== 'REAL_MONEY' || !binanceKey) return;
  const realBal = await getRealBalance(binanceKey, binanceSecret);
  if (realBal > 0) {
    portfolio.balance = realBal;
    calculateEquity();
    savePortfolioState();
  }
};

// --- Persistence Layer ---
export const loadPortfolioState = async (): Promise<Portfolio> => {
  try {
    const saved = await loadFromDB('portfolio', 1);
    if (saved) {
      portfolio = saved;
      // Migration: Ensure new arrays exist
      if (!portfolio.spotPositions) portfolio.spotPositions = (portfolio as any).positions || [];
      if (!portfolio.futuresPositions) portfolio.futuresPositions = [];
    } else {
      await savePortfolioState();
    }
  } catch (e) {
    console.error("Failed to load DB:", e);
  }
  return { ...portfolio };
};

export const savePortfolioState = async () => {
  portfolio.lastUpdated = Date.now();
  // Legacy compatibility: sync positions for older logic if any
  (portfolio as any).positions = [...portfolio.spotPositions, ...portfolio.futuresPositions]; 
  await saveToDB('portfolio', portfolio);
};

// --- Logic Layer ---
export const initPortfolio = (initialBudget: number) => {
  portfolio = {
    id: 1,
    balance: initialBudget,
    equity: initialBudget,
    spotPositions: [],
    futuresPositions: [],
    tradeHistory: [],
    equityHistory: [{ time: Date.now(), equity: initialBudget, balance: initialBudget }],
    lastUpdated: Date.now()
  };
  savePortfolioState();
};

export const updateCurrentPrice = (price: number) => {
  currentPrice = price;
  calculateEquity();
  
  const now = Date.now();
  if (now - lastSnapshotTime > 60000) {
      captureEquitySnapshot();
  }
};

const captureEquitySnapshot = () => {
    const now = Date.now();
    portfolio.equityHistory.push({
        time: now,
        equity: portfolio.equity,
        balance: portfolio.balance
    });
    if (portfolio.equityHistory.length > 1000) {
        portfolio.equityHistory.shift();
    }
    lastSnapshotTime = now;
};

const calculateEquity = () => {
  let unrealizedTotal = 0;

  // 1. Calc Spot Positions
  portfolio.spotPositions = portfolio.spotPositions.map(pos => {
      // Trailing Stop Logic (Long Only for Spot)
      let newHigh = pos.highestPriceSinceEntry ? Math.max(pos.highestPriceSinceEntry, currentPrice) : currentPrice;
      let newTrailingTrigger = pos.trailingStopTrigger;

      if (pos.trailingStopPct && newHigh > (pos.highestPriceSinceEntry || 0)) {
          const proposedTrigger = newHigh * (1 - (pos.trailingStopPct / 100));
          if (!newTrailingTrigger || proposedTrigger > newTrailingTrigger) {
              newTrailingTrigger = proposedTrigger;
          }
      }

      const currentVal = pos.amount * currentPrice;
      const costBasis = pos.amount * pos.entryPrice;
      const uPnL = currentVal - costBasis;
      unrealizedTotal += uPnL;

      return {
          ...pos,
          currentPrice: currentPrice,
          highestPriceSinceEntry: newHigh,
          trailingStopTrigger: newTrailingTrigger,
          unrealizedPnL: uPnL,
          pnlPercentage: costBasis > 0 ? (uPnL / costBasis) * 100 : 0
      };
  });

  // 2. Calc Futures Positions
  portfolio.futuresPositions = portfolio.futuresPositions.map(pos => {
      // Determine direction multiplier
      const isLong = pos.side === 'LONG';
      const direction = isLong ? 1 : -1;
      
      // Unrealized PnL = (Current - Entry) * Amount * Direction
      // Amount is size in COIN.
      const uPnL = (currentPrice - pos.entryPrice) * pos.amount * direction;
      unrealizedTotal += uPnL;
      
      // Margin Pct = uPnL / MarginUsed
      const pnlPct = pos.marginUsed ? (uPnL / pos.marginUsed) * 100 : 0;

      // Trailing Logic (Different for Short!)
      let newHighOrLow = pos.highestPriceSinceEntry || pos.entryPrice;
      let newTrailingTrigger = pos.trailingStopTrigger;
      
      if (isLong) {
          // Track Highest High
          newHighOrLow = Math.max(newHighOrLow, currentPrice);
          if (pos.trailingStopPct) {
              const proposed = newHighOrLow * (1 - (pos.trailingStopPct / 100));
              if (!newTrailingTrigger || proposed > newTrailingTrigger) newTrailingTrigger = proposed;
          }
      } else {
          // Track Lowest Low (For Short, we want price to drop)
          newHighOrLow = Math.min(newHighOrLow, currentPrice);
          if (pos.trailingStopPct) {
              // Stop moves DOWN as price drops. Stop is ABOVE current price.
              const proposed = newHighOrLow * (1 + (pos.trailingStopPct / 100));
              if (!newTrailingTrigger || proposed < newTrailingTrigger) newTrailingTrigger = proposed;
          }
      }

      // Check Liquidation (Simulation)
      if (pos.liquidationPrice) {
          const triggered = isLong ? currentPrice <= pos.liquidationPrice : currentPrice >= pos.liquidationPrice;
          if (triggered) {
             // Mark for liquidation execution in trigger check loop
          }
      }

      return {
          ...pos,
          currentPrice,
          highestPriceSinceEntry: newHighOrLow,
          trailingStopTrigger: newTrailingTrigger,
          unrealizedPnL: uPnL,
          pnlPercentage: pnlPct
      };
  });

  portfolio.equity = portfolio.balance + unrealizedTotal;
};

export const getPortfolio = (): Portfolio => {
  calculateEquity();
  return { ...portfolio };
};

// Combined Triggers
export const checkTradeTriggers = async (): Promise<Trade | null> => {
  if (currentPrice === 0) return null;
  calculateEquity();

  // Spot Triggers
  for (const pos of portfolio.spotPositions) {
    if (pos.stopLoss && currentPrice <= pos.stopLoss) 
        return await executeOrder('SELL', 1.0, pos.symbol, "Spot SL", 0, 0, "Risk", 0, 'SPOT', 1);
    if (pos.takeProfit && currentPrice >= pos.takeProfit) 
        return await executeOrder('SELL', 1.0, pos.symbol, "Spot TP", 0, 0, "Risk", 0, 'SPOT', 1);
    if (pos.trailingStopTrigger && currentPrice <= pos.trailingStopTrigger) 
        return await executeOrder('SELL', 1.0, pos.symbol, "Spot Trailing", 0, 0, "Risk", 0, 'SPOT', 1);
  }

  // Futures Triggers
  for (const pos of portfolio.futuresPositions) {
      const isLong = pos.side === 'LONG';
      let triggerAction: 'CLOSE_LONG' | 'CLOSE_SHORT' = isLong ? 'CLOSE_LONG' : 'CLOSE_SHORT';
      
      // Liquidation
      if (pos.liquidationPrice) {
          const liqHit = isLong ? currentPrice <= pos.liquidationPrice : currentPrice >= pos.liquidationPrice;
          if (liqHit) return await executeOrder(triggerAction, 1.0, pos.symbol, "LIQUIDATION", 0,0,"Risk",0,'FUTURES', pos.leverage);
      }

      // SL
      if (pos.stopLoss) {
          const slHit = isLong ? currentPrice <= pos.stopLoss : currentPrice >= pos.stopLoss;
          if (slHit) return await executeOrder(triggerAction, 1.0, pos.symbol, "Futures SL", 0,0,"Risk",0,'FUTURES', pos.leverage);
      }

      // TP
      if (pos.takeProfit) {
          const tpHit = isLong ? currentPrice >= pos.takeProfit : currentPrice <= pos.takeProfit;
          if (tpHit) return await executeOrder(triggerAction, 1.0, pos.symbol, "Futures TP", 0,0,"Risk",0,'FUTURES', pos.leverage);
      }

      // Trailing
      if (pos.trailingStopTrigger) {
          const trailHit = isLong ? currentPrice <= pos.trailingStopTrigger : currentPrice >= pos.trailingStopTrigger;
          if (trailHit) return await executeOrder(triggerAction, 1.0, pos.symbol, "Futures Trailing", 0,0,"Risk",0,'FUTURES', pos.leverage);
      }
  }

  return null;
};

// Central Execution Engine
export const executeOrder = async (
  action: string, // BUY, SELL, OPEN_LONG, OPEN_SHORT, CLOSE_LONG, CLOSE_SHORT
  amountPct: number, 
  symbol: string, 
  reason: string,
  stopLoss?: number,
  takeProfit?: number,
  strategyUsed: string = "Manual",
  trailingStopPct?: number,
  marketType: 'SPOT' | 'FUTURES' = 'SPOT',
  leverage: number = 1,
  credentials?: { apiKey: string, secretKey: string }
): Promise<Trade | null> => {
  
  if (amountPct <= 0 || currentPrice === 0) return null;
  const timestamp = Date.now();
  
  // NORMALIZE ACTION
  // Maps explicit Futures actions to standard Side for API, or treats Spot BUY/SELL
  let side: 'BUY' | 'SELL' = 'BUY'; 
  if (['BUY', 'OPEN_LONG', 'CLOSE_SHORT'].includes(action)) side = 'BUY';
  if (['SELL', 'OPEN_SHORT', 'CLOSE_LONG'].includes(action)) side = 'SELL';

  // --- FUTURES SIMULATION LOGIC ---
  if (marketType === 'FUTURES') {
      const existingIndex = portfolio.futuresPositions.findIndex(p => p.symbol === symbol);
      const existingPos = portfolio.futuresPositions[existingIndex];

      // CLOSING POSITIONS
      if ((action === 'CLOSE_LONG' && existingPos?.side === 'LONG') || 
          (action === 'CLOSE_SHORT' && existingPos?.side === 'SHORT')) {
          
          const amountToClose = existingPos.amount * amountPct;
          const direction = existingPos.side === 'LONG' ? 1 : -1;
          const pnl = (currentPrice - existingPos.entryPrice) * amountToClose * direction;
          
          // Return Margin + PnL to Balance
          // Proportional margin release
          const marginReleased = (existingPos.marginUsed || 0) * amountPct; 
          portfolio.balance += (marginReleased + pnl);

          existingPos.amount -= amountToClose;
          existingPos.marginUsed = (existingPos.marginUsed || 0) - marginReleased;

          if (existingPos.amount * currentPrice < 10) {
              portfolio.futuresPositions.splice(existingIndex, 1);
          }

          const trade: Trade = {
              id: Math.random().toString(36).substr(2, 9),
              symbol, marketType: 'FUTURES', side: side,
              price: currentPrice, amount: amountToClose, cost: marginReleased, leverage: existingPos.leverage,
              timestamp, pnl, reason, strategyUsed
          };
          portfolio.tradeHistory.unshift(trade);
          captureEquitySnapshot(); savePortfolioState();
          return trade;
      }

      // OPENING POSITIONS
      if (action === 'OPEN_LONG' || action === 'OPEN_SHORT') {
          // If opposing position exists, force close it first (simplified hedge mode off)
          if (existingPos && existingPos.side !== (action === 'OPEN_LONG' ? 'LONG' : 'SHORT')) {
              // Close opposing first
              await executeOrder(action === 'OPEN_LONG' ? 'CLOSE_SHORT' : 'CLOSE_LONG', 1.0, symbol, "Flip Position", 0,0,"Auto",0, 'FUTURES', leverage);
          }

          // Calculate Cost (Margin)
          const budget = portfolio.balance * amountPct;
          const notionalValue = budget * leverage;
          const amount = notionalValue / currentPrice;
          
          if (budget < 10) return null;

          portfolio.balance -= budget;

          // Liquidation Logic (Simple Isolation)
          // Long Liq: Entry * (1 - 1/Lev)
          // Short Liq: Entry * (1 + 1/Lev)
          const liqPrice = action === 'OPEN_LONG' 
              ? currentPrice * (1 - (1/leverage) + 0.01) // 1% buffer
              : currentPrice * (1 + (1/leverage) - 0.01);

          // Trailing Setup
          let trailingTrigger = undefined;
          if (trailingStopPct) {
              trailingTrigger = action === 'OPEN_LONG'
                  ? currentPrice * (1 - (trailingStopPct/100))
                  : currentPrice * (1 + (trailingStopPct/100));
          }

          const newPos: Position = {
              id: Math.random().toString(36).substr(2, 9),
              symbol, marketType: 'FUTURES', side: action === 'OPEN_LONG' ? 'LONG' : 'SHORT',
              amount, entryPrice: currentPrice, currentPrice, leverage,
              marginUsed: budget, liquidationPrice: liqPrice,
              unrealizedPnL: 0, pnlPercentage: 0,
              stopLoss, takeProfit, trailingStopPct, trailingStopTrigger: trailingTrigger,
              highestPriceSinceEntry: currentPrice // Initial
          };
          
          portfolio.futuresPositions.push(newPos);

          const trade: Trade = {
            id: Math.random().toString(36).substr(2, 9),
            symbol, marketType: 'FUTURES', side: side,
            price: currentPrice, amount, cost: budget, leverage,
            timestamp, reason, strategyUsed
          };
          portfolio.tradeHistory.unshift(trade);
          captureEquitySnapshot(); savePortfolioState();
          return trade;
      }
  }

  // --- SPOT LOGIC (Classic) ---
  if (marketType === 'SPOT') {
      // Execute REAL Spot if active
      if (tradingMode === 'REAL_MONEY' && credentials?.apiKey) {
          try {
              if (side === 'BUY') {
                  const budget = portfolio.balance * Math.min(amountPct, 1);
                  const res = await executeRealBinanceOrder(symbol, 'BUY', budget, true, credentials);
                  if (res) {
                    portfolio.balance -= res.cost;
                    // ... (Similar update logic to before, mapped to spotPositions)
                    // Simplified for brevity, assume similar structure to below simulation
                  }
              }
              // ... Handle Real Sell
          } catch (e) {
              console.error("Real Spot Failed", e);
              return null;
          }
      }

      // Simulation Spot
      if (side === 'BUY') {
          const budget = portfolio.balance * Math.min(amountPct, 1);
          const amount = budget / currentPrice;
          if (budget < 10) return null;

          portfolio.balance -= budget;
          
          let trailingTrigger = undefined;
          if (trailingStopPct) trailingTrigger = currentPrice * (1 - (trailingStopPct/100));

          const existing = portfolio.spotPositions.find(p => p.symbol === symbol);
          if (existing) {
              const totalCost = (existing.amount * existing.entryPrice) + budget;
              existing.amount += amount;
              existing.entryPrice = totalCost / existing.amount;
              if (stopLoss) existing.stopLoss = stopLoss;
              if (takeProfit) existing.takeProfit = takeProfit;
              if (trailingStopPct) existing.trailingStopPct = trailingStopPct;
          } else {
              portfolio.spotPositions.push({
                  id: Math.random().toString(), symbol, marketType: 'SPOT', side: 'LONG',
                  amount, entryPrice: currentPrice, currentPrice, leverage: 1,
                  unrealizedPnL: 0, pnlPercentage: 0, stopLoss, takeProfit,
                  highestPriceSinceEntry: currentPrice, trailingStopTrigger: trailingTrigger, trailingStopPct
              });
          }
          const trade: Trade = {
            id: Math.random().toString(), symbol, marketType: 'SPOT', side: 'BUY',
            price: currentPrice, amount, cost: budget, leverage: 1, timestamp, reason, strategyUsed
          };
          portfolio.tradeHistory.unshift(trade);
          captureEquitySnapshot(); savePortfolioState();
          return trade;

      } else {
          // SELL
          const idx = portfolio.spotPositions.findIndex(p => p.symbol === symbol);
          if (idx === -1) return null;
          const pos = portfolio.spotPositions[idx];
          const amountToSell = pos.amount * amountPct;
          const revenue = amountToSell * currentPrice;
          const costBasis = amountToSell * pos.entryPrice;
          const pnl = revenue - costBasis;
          
          portfolio.balance += revenue;
          pos.amount -= amountToSell;
          if (pos.amount * currentPrice < 5) portfolio.spotPositions.splice(idx, 1);

          const trade: Trade = {
            id: Math.random().toString(), symbol, marketType: 'SPOT', side: 'SELL',
            price: currentPrice, amount: amountToSell, cost: revenue, leverage: 1, pnl, timestamp, reason, strategyUsed
          };
          portfolio.tradeHistory.unshift(trade);
          captureEquitySnapshot(); savePortfolioState();
          return trade;
      }
  }

  return null;
};

export const liquidateAllPositions = async (reason: string): Promise<number> => {
    let count = 0;
    // Spot
    for (const p of [...portfolio.spotPositions]) {
        await executeOrder('SELL', 1.0, p.symbol, reason, 0,0,'PANIC',0,'SPOT',1);
        count++;
    }
    // Futures
    for (const p of [...portfolio.futuresPositions]) {
        const action = p.side === 'LONG' ? 'CLOSE_LONG' : 'CLOSE_SHORT';
        await executeOrder(action, 1.0, p.symbol, reason, 0,0,'PANIC',0,'FUTURES', p.leverage);
        count++;
    }
    return count;
};

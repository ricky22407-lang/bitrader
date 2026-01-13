
import React, { useEffect, useRef } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi, CandlestickSeries, SeriesMarker, Time } from 'lightweight-charts';
import { Ticker, Portfolio, Position } from '../types';

interface ChartProps {
  data: Ticker[];
  portfolio: Portfolio; 
}

const RealtimeChart: React.FC<ChartProps> = ({ data, portfolio }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const priceLinesRef = useRef<any[]>([]);

  // Initialize Chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Use parent height
    const chart = createChart(chartContainerRef.current, {
      layout: { background: { type: ColorType.Solid, color: '#0f172a' }, textColor: '#94a3b8' },
      grid: { vertLines: { color: '#1e293b' }, horzLines: { color: '#1e293b' } },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight, // Dynamic Height
      timeScale: { timeVisible: true, secondsVisible: true },
      crosshair: { mode: 1 }
    });

    try {
        const candlestickSeries = chart.addSeries(CandlestickSeries, {
            upColor: '#10b981', downColor: '#ef4444', borderVisible: false, wickUpColor: '#10b981', wickDownColor: '#ef4444',
        });
        
        chartRef.current = chart;
        seriesRef.current = candlestickSeries;
    } catch (e) {
        console.error("Failed to add series:", e);
    }

    const handleResize = () => {
      if (chartRef.current && chartContainerRef.current) {
        chartRef.current.applyOptions({ 
            width: chartContainerRef.current.clientWidth,
            height: chartContainerRef.current.clientHeight
        });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
          chartRef.current.remove();
          chartRef.current = null;
      }
      seriesRef.current = null; 
    };
  }, []);

  // Update Data
  useEffect(() => {
    if (seriesRef.current && data.length > 0) {
      const formattedData = data.map(d => ({
        time: d.time as Time, open: d.open, high: d.high, low: d.low, close: d.close
      }));
      try {
        // Safety check for method existence
        if (typeof seriesRef.current.setData === 'function') {
            if (data.length > 100) seriesRef.current.setData(formattedData);
            else seriesRef.current.update(formattedData[formattedData.length - 1]);
        }
      } catch (e) {
          console.warn("Chart Update Error:", e);
      }
    }
  }, [data]);

  // UPDATE MARKERS & LINES
  useEffect(() => {
    if (!seriesRef.current || !chartRef.current) return;
    
    // Safety check: ensure setMarkers exists on the current series instance
    if (typeof seriesRef.current.setMarkers !== 'function') return;

    try {
        // 1. Markers
        const markers: SeriesMarker<Time>[] = [];
        portfolio.tradeHistory.forEach(trade => {
            const tradeTime = Math.floor(trade.timestamp / 1000) as Time;
            // Simple validation to ensure marker time is within reasonable chart range could go here
            const color = trade.pnl && trade.pnl > 0 ? '#10b981' : trade.pnl && trade.pnl < 0 ? '#ef4444' : '#fbbf24';
            
            markers.push({
                time: tradeTime,
                position: trade.side === 'BUY' ? 'belowBar' : 'aboveBar',
                color: color,
                shape: trade.side === 'BUY' ? 'arrowUp' : 'arrowDown',
                text: trade.marketType === 'FUTURES' ? `F(${trade.leverage}x)` : 'SPOT',
                size: 1
            });
        });
        seriesRef.current.setMarkers(markers);

        // 2. Clear Old Lines
        priceLinesRef.current.forEach(line => {
             // Check if removePriceLine exists on the series instance before calling
             if (seriesRef.current && typeof seriesRef.current.removePriceLine === 'function') {
                 try { seriesRef.current.removePriceLine(line); } catch(e){}
             }
        });
        priceLinesRef.current = [];

        // 3. Draw Active Lines
        const activePositions = [...portfolio.spotPositions, ...portfolio.futuresPositions];
        
        activePositions.forEach(pos => {
            if (!seriesRef.current) return;
            
            // Entry
            if (typeof seriesRef.current.createPriceLine === 'function') {
                priceLinesRef.current.push(seriesRef.current.createPriceLine({
                    price: pos.entryPrice,
                    color: pos.side === 'LONG' ? '#3b82f6' : '#f59e0b',
                    lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: `${pos.marketType} ${pos.side} ENTRY`
                }));

                // Stop Loss
                if (pos.stopLoss) {
                    priceLinesRef.current.push(seriesRef.current.createPriceLine({
                        price: pos.stopLoss, color: '#ef4444', lineWidth: 2, lineStyle: 1, axisLabelVisible: true, title: 'SL'
                    }));
                }

                // Liquidation (Futures)
                if (pos.liquidationPrice) {
                    priceLinesRef.current.push(seriesRef.current.createPriceLine({
                        price: pos.liquidationPrice, color: '#dc2626', lineWidth: 1, lineStyle: 0, axisLabelVisible: true, title: 'LIQ'
                    }));
                }
            }
        });
    } catch (e) {
        console.warn("Chart Marker Update Error:", e);
    }

  }, [portfolio, data]); 

  return (
    <div className="w-full h-full border border-slate-800 rounded-xl overflow-hidden shadow-lg relative bg-[#0f172a]">
      <div ref={chartContainerRef} className="w-full h-full" />
    </div>
  );
};

export default RealtimeChart;

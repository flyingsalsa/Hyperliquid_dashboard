import { NextResponse } from 'next/server';

export async function GET() {
    try {
        // Fetch all data in parallel
        // Bybit: Limit 1000 to get most active pairs
        // Hyperliquid: standard meta endpoint
        const [binanceRatesRes, binanceTickerRes, bybitRes, hlRes] = await Promise.all([
            fetch('https://fapi.binance.com/fapi/v1/premiumIndex', { next: { revalidate: 0 } }),
            fetch('https://fapi.binance.com/fapi/v1/ticker/24hr', { next: { revalidate: 0 } }),
            fetch('https://api.bybit.com/v5/market/tickers?category=linear&limit=1000', { next: { revalidate: 0 } }),
            fetch('https://api.hyperliquid.xyz/info', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'metaAndAssetCtxs' }),
                next: { revalidate: 0 }
            })
        ]);

        if (!binanceRatesRes.ok || !binanceTickerRes.ok) {
            throw new Error(`Binance API Error`);
        }

        const binanceRates = await binanceRatesRes.json();
        const binanceTicker = await binanceTickerRes.json();
        const bybitData = await bybitRes.json(); // Bybit returns { retCode: 0, result: { list: [] } }
        const hlData = await hlRes.json(); // HL returns [meta, assetCtxs]

        // 1. Process Binance Data (The "Source of Truth" for the list)
        const binanceTickerMap = new Map(binanceTicker.map(item => [item.symbol, item]));

        // Merge Rate + Volume
        let combinedBinance = binanceRates.map(rate => {
            const ticker = binanceTickerMap.get(rate.symbol);
            return {
                symbol: rate.symbol,
                markPrice: rate.markPrice,
                binanceRate: rate.lastFundingRate,
                nextFundingTime: rate.nextFundingTime,
                quoteVolume: ticker ? parseFloat(ticker.quoteVolume) : 0,
                baseSymbol: rate.symbol.replace('USDT', '') // Simple extraction
            };
        });

        // Sort by Volume (Desc) and take Top 200
        combinedBinance.sort((a, b) => b.quoteVolume - a.quoteVolume);
        const top200 = combinedBinance.slice(0, 200);

        // 2. Process Bybit Data
        const bybitMap = new Map();
        if (bybitData.result && bybitData.result.list) {
            bybitData.result.list.forEach(item => {
                // Bybit symbols are like BTCUSDT
                const base = item.symbol.replace('USDT', '');
                bybitMap.set(base, item.fundingRate);
            });
        }

        // 3. Process Hyperliquid Data
        const hlMap = new Map();
        // hlData is [universe, assetCtxs]
        // universe.universe is array of { name: "BTC", ... }
        // assetCtxs is array of objects (indices match universe)
        if (Array.isArray(hlData) && hlData.length === 2) {
            const universe = hlData[0].universe;
            const assetCtxs = hlData[1];

            universe.forEach((coin, index) => {
                const ctx = assetCtxs[index];
                if (ctx) {
                    hlMap.set(coin.name, ctx.funding);
                }
            });
        }

        // 4. Merge All
        const finalData = top200.map(item => {
            return {
                symbol: item.symbol,
                price: item.markPrice,
                volume: item.quoteVolume,
                binanceRate: item.binanceRate,
                nextFunding: item.nextFundingTime,
                // Lookups
                bybitRate: bybitMap.get(item.baseSymbol) || null,
                hlRate: hlMap.get(item.baseSymbol) || null
            };
        });

        return NextResponse.json(finalData);

    } catch (error) {
        console.error('Error fetching funding rates:', error);
        return NextResponse.json({ error: 'Failed to fetch funding rates' }, { status: 500 });
    }
}

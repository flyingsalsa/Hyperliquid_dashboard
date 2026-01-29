const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from the current directory
app.use(express.static(__dirname));

// Route for the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Proxy endpoint for Binance funding rates
app.get('/api/funding-rates', async (req, res) => {
    try {
        // Fetch all data in parallel
        // Bybit: Limit 1000 to get most active pairs
        // Hyperliquid: standard meta endpoint
        const [binanceRatesRes, binanceTickerRes, bybitRes, hlRes] = await Promise.all([
            fetch('https://fapi.binance.com/fapi/v1/premiumIndex'),
            fetch('https://fapi.binance.com/fapi/v1/ticker/24hr'),
            fetch('https://api.bybit.com/v5/market/tickers?category=linear&limit=1000'),
            fetch('https://api.hyperliquid.xyz/info', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'metaAndAssetCtxs' })
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
                    // HL funding is hourly, but often displayed as hourly rate
                    // We need to check if user wants 8h equivalent? 
                    // Usually HL displays hourly. Binance is 8h. 
                    // To compare apples-to-apples, we might multiply HL by 8, strictly speaking.
                    // But typically dashboards show the "raw" rate provided by the exchange.
                    // HL funding variable is "funding"
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

        res.json(finalData);

    } catch (error) {
        console.error('Error fetching funding rates:', error);
        res.status(500).json({ error: 'Failed to fetch funding rates' });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

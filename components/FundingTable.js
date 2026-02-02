'use client';

import { useState, useEffect } from 'react';

export default function FundingTable() {
    const [rates, setRates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [lastUpdated, setLastUpdated] = useState('');

    const fetchRates = async () => {
        try {
            const response = await fetch('/api/funding-rates');
            if (!response.ok) throw new Error('Network response was not ok');
            const data = await response.json();

            // Sort by 24h Quote Volume (descending) by default
            data.sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume));

            setRates(data);
            setLastUpdated(new Date().toLocaleTimeString());
            setLoading(false);
        } catch (error) {
            console.error('Error:', error);
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRates();
        const interval = setInterval(fetchRates, 60000); // Auto-refresh every 60s
        return () => clearInterval(interval);
    }, []);

    const formatVolume = (volume) => {
        const val = parseFloat(volume);
        if (val >= 1000000000) return '$' + (val / 1000000000).toFixed(2) + 'B';
        if (val >= 1000000) return '$' + (val / 1000000).toFixed(2) + 'M';
        if (val >= 1000) return '$' + (val / 1000).toFixed(2) + 'K';
        return '$' + val.toFixed(2);
    };

    const formatRate = (val) => {
        if (val === null || val === undefined) return '-';
        const num = parseFloat(val);
        return (num * 100).toFixed(6) + '%';
    };

    const getRateClass = (val) => {
        if (val === null || val === undefined) return 'neutral-rate';
        const num = parseFloat(val);
        if (num > 0) return 'positive-rate';
        if (num < 0) return 'negative-rate';
        return 'neutral-rate';
    };

    const filteredRates = rates.filter(rate =>
        rate.symbol.toUpperCase().includes(search.toUpperCase())
    );

    return (
        <div className="table-container">
            <div className="table-header">
                <h2>Binance Funding Rates
                    {lastUpdated &&
                        <span style={{ fontSize: '14px', color: '#888', fontWeight: 'normal', marginLeft: '10px' }}>
                            Last updated: {lastUpdated}
                        </span>
                    }
                </h2>
                <input
                    type="text"
                    placeholder="Search Symbol..."
                    className="search-input"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>
            <div className="table-wrapper">
                <table className="rates-table">
                    <thead>
                        <tr>
                            <th>Symbol</th>
                            <th>Price</th>
                            <th>Volume (24h)</th>
                            <th>Binance Rate</th>
                            <th>Bybit Rate</th>
                            <th>HL Rate</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan="6" className="loading-message">Loading data...</td>
                            </tr>
                        ) : filteredRates.length === 0 ? (
                            <tr>
                                <td colSpan="6" className="loading-message">No matches found</td>
                            </tr>
                        ) : (
                            filteredRates.map(rate => (
                                <tr key={rate.symbol}>
                                    <td>{rate.symbol}</td>
                                    <td>{parseFloat(rate.markPrice || rate.price).toFixed(2)}</td>
                                    <td>{formatVolume(rate.quoteVolume || rate.volume)}</td>
                                    <td className={getRateClass(rate.binanceRate)}>
                                        {formatRate(rate.binanceRate)}
                                    </td>
                                    <td className={getRateClass(rate.bybitRate)}>
                                        {formatRate(rate.bybitRate)}
                                    </td>
                                    <td className={getRateClass(rate.hlRate)}>
                                        {formatRate(rate.hlRate)}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

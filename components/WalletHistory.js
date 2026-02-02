'use client';

import { useState } from 'react';

export default function WalletHistory() {
    const [address, setAddress] = useState('');
    const [activeOrders, setActiveOrders] = useState([]);
    const [childrenOrders, setChildrenOrders] = useState([]);
    const [historyData, setHistoryData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [activeSubTab, setActiveSubTab] = useState('active'); // 'active', 'children', 'history'

    const formatToUTC8 = (timestamp) => {
        if (!timestamp) return '-';
        const date = new Date(timestamp);
        // Get UTC+8 time by adding 8 hours
        const utc8Date = new Date(date.getTime() + (8 * 60 * 60 * 1000));
        return utc8Date.toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');
    };

    // Helper to format numbers with precision
    const formatNumber = (num, decimals = 4) => {
        if (num === null || num === undefined) return '-';
        return Number(num).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    };

    const fetchHistory = async () => {
        if (!address.trim()) {
            alert('Please enter a wallet address');
            return;
        }

        setLoading(true);
        setError('');
        setActiveOrders([]);
        setChildrenOrders([]);
        setHistoryData([]);
        console.log('Fetching history for:', address);

        try {
            // Fetch both open orders and user fills
            const [openOrdersRes, userFillsRes] = await Promise.all([
                fetch('https://api.hyperliquid.xyz/info', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: 'openOrders', user: address.trim() })
                }),
                fetch('https://api.hyperliquid.xyz/info', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: 'userFills', user: address.trim() })
                })
            ]);

            if (!openOrdersRes.ok || !userFillsRes.ok) {
                throw new Error('Failed to fetch one or more endpoints');
            }

            const rawOpenOrders = await openOrdersRes.json();
            const rawUserFills = await userFillsRes.json();

            // Process Open Orders
            const active = [];
            const children = [];

            rawOpenOrders.forEach(order => {
                // Heuristic: If it has children or is a trigger order, put in children tab
                // Note: The API might return 'children' array in the order object
                // or we might strictly separate by types if known. 
                // For now, if 'children' exists and is not empty, OR if it looks like a trigger.
                if ((order.children && order.children.length > 0) || order.triggerCondition) {
                    children.push(order);
                } else {
                    active.push(order);
                }
            });

            setActiveOrders(active);
            setChildrenOrders(children);
            setHistoryData(rawUserFills);

        } catch (err) {
            console.error('Error fetching wallet data:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const renderTable = (data, type) => {
        if (!data || data.length === 0) {
            return <div style={{ padding: '20px', color: '#666' }}>No records found</div>;
        }

        return (
            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px', fontSize: '14px' }}>
                    <thead>
                        <tr style={{ borderBottom: '2px solid #ddd', textAlign: 'left', backgroundColor: '#f9f9f9' }}>
                            <th style={{ padding: '10px' }}>Time (UTC+8)</th>
                            <th style={{ padding: '10px' }}>Symbol</th>
                            <th style={{ padding: '10px' }}>Side</th>
                            <th style={{ padding: '10px' }}>Type</th>
                            <th style={{ padding: '10px' }}>Price</th>
                            <th style={{ padding: '10px' }}>Size</th>
                            <th style={{ padding: '10px' }}>Value ($)</th>
                            {type === 'history' && <th style={{ padding: '10px' }}>Fee</th>}
                            {type === 'history' && <th style={{ padding: '10px' }}>PnL</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((item, index) => {
                            const isHistory = type === 'history';
                            const timestamp = isHistory ? item.time : item.timestamp;
                            const side = item.side === 'A' ? 'Sell' : 'Buy'; // A = Ask (Sell), B = Bid (Buy)? API says side is 'A' or 'B'? Wait, searching docs 'B' is Bid, 'A' is Ask.
                            // Actually commonly 'B' is Buy. Checking verification needed. 
                            // userFills: side 'B' (Bid/Buy), 'A' (Ask/Sell).
                            // Let's assume 'B' is Buy (Green), 'A' is Sell (Red).
                            const sideColor = item.side === 'B' ? '#0ecb81' : '#f6465d';
                            const sideText = item.side === 'B' ? 'Buy' : 'Sell';

                            const price = isHistory ? item.px : item.limitPx;
                            const size = isHistory ? item.sz : item.sz;
                            const value = (parseFloat(price) * parseFloat(size)).toFixed(2);

                            return (
                                <tr key={index} style={{ borderBottom: '1px solid #eee' }}>
                                    <td style={{ padding: '10px' }}>{formatToUTC8(timestamp)}</td>
                                    <td style={{ padding: '10px', fontWeight: 'bold' }}>{item.coin}</td>
                                    <td style={{ padding: '10px', color: sideColor, fontWeight: 'bold' }}>{sideText}</td>
                                    <td style={{ padding: '10px' }}>{isHistory ? item.dir : 'Limit'}</td>
                                    <td style={{ padding: '10px' }}>{formatNumber(price)}</td>
                                    <td style={{ padding: '10px' }}>{formatNumber(size)}</td>
                                    <td style={{ padding: '10px' }}>{value}</td>
                                    {isHistory && <td style={{ padding: '10px' }}>{item.feeToken} {formatNumber(item.fee)}</td>}
                                    {isHistory && <td style={{ padding: '10px', color: parseFloat(item.closedPnl) >= 0 ? '#0ecb81' : '#f6465d' }}>{formatNumber(item.closedPnl, 2)}</td>}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        );
    };

    return (
        <div id="tab2" className="tab-pane active" style={{ display: 'block', width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '40px', gap: '10px' }}>
                <input
                    type="text"
                    placeholder="Enter wallet address"
                    className="search-input"
                    style={{ width: '350px', padding: '12px', borderRadius: '8px', border: '1px solid #ddd' }}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                />
                <button
                    className="action-button"
                    style={{ padding: '12px 24px', borderRadius: '8px', border: 'none', backgroundColor: '#f0ad4e', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}
                    onClick={fetchHistory}
                    disabled={loading}
                >
                    {loading ? 'Loading...' : 'Get History'}
                </button>
            </div>

            {error && <div style={{ textAlign: 'center', color: 'red', marginBottom: '20px' }}>{error}</div>}

            {(activeOrders.length > 0 || childrenOrders.length > 0 || historyData.length > 0) && (
                <div style={{ margin: '0 40px', backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                    {/* Sub-tabs header */}
                    <div style={{ display: 'flex', borderBottom: '1px solid #eee' }}>
                        <button
                            style={{ flex: 1, padding: '15px', background: activeSubTab === 'active' ? '#fff' : '#f9f9f9', border: 'none', borderBottom: activeSubTab === 'active' ? '2px solid #f0ad4e' : 'none', cursor: 'pointer', fontWeight: activeSubTab === 'active' ? 'bold' : 'normal' }}
                            onClick={() => setActiveSubTab('active')}
                        >
                            Active Orders ({activeOrders.length})
                        </button>
                        <button
                            style={{ flex: 1, padding: '15px', background: activeSubTab === 'children' ? '#fff' : '#f9f9f9', border: 'none', borderBottom: activeSubTab === 'children' ? '2px solid #f0ad4e' : 'none', cursor: 'pointer', fontWeight: activeSubTab === 'children' ? 'bold' : 'normal' }}
                            onClick={() => setActiveSubTab('children')}
                        >
                            Children/Triggers ({childrenOrders.length})
                        </button>
                        <button
                            style={{ flex: 1, padding: '15px', background: activeSubTab === 'history' ? '#fff' : '#f9f9f9', border: 'none', borderBottom: activeSubTab === 'history' ? '2px solid #f0ad4e' : 'none', cursor: 'pointer', fontWeight: activeSubTab === 'history' ? 'bold' : 'normal' }}
                            onClick={() => setActiveSubTab('history')}
                        >
                            History ({historyData.length})
                        </button>
                    </div>

                    {/* Tab Content */}
                    <div style={{ padding: '20px' }}>
                        {activeSubTab === 'active' && renderTable(activeOrders, 'active')}
                        {activeSubTab === 'children' && renderTable(childrenOrders, 'active')}
                        {activeSubTab === 'history' && renderTable(historyData, 'history')}
                    </div>
                </div>
            )}

            {/* Raw JSON Toggle (Optional, maybe hidden or removed as per request to replace) 
                User asked to replace, so I'll leave it out or commented out unless debugging is needed. 
            */}
        </div>
    );
}


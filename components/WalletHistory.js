'use client';

import { useState } from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

export default function WalletHistory() {
    const [address, setAddress] = useState('');
    const [activeOrders, setActiveOrders] = useState([]);
    const [childrenOrders, setChildrenOrders] = useState([]);
    const [historyData, setHistoryData] = useState([]);
    const [pnlData, setPnlData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [activeSubTab, setActiveSubTab] = useState('active'); // 'active', 'children', 'history'
    const [hasFetched, setHasFetched] = useState(false);

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
        setPnlData(null);
        setHasFetched(false);
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

            // Process PnL Data (Last 60 days)
            processPnlData(rawUserFills);

        } catch (err) {
            console.error('Error fetching wallet data:', err);
            setError(err.message);
        } finally {
            setLoading(false);
            setHasFetched(true);
        }
    };

    const processPnlData = (fills) => {
        if (!fills || fills.length === 0) {
            setPnlData(null);
            return;
        }

        const twoMonthsAgo = Date.now() - (60 * 24 * 60 * 60 * 1000);

        // Filter fills from last 2 months and sort by time ascending
        const relevantFills = fills
            .filter(fill => fill.time >= twoMonthsAgo)
            .sort((a, b) => a.time - b.time);

        if (relevantFills.length === 0) {
            setPnlData(null);
            return;
        }

        const labels = [];
        const dataPoints = [];
        let cumulativePnl = 0;

        relevantFills.forEach(fill => {
            const pnl = parseFloat(fill.closedPnl || 0);
            if (pnl !== 0) { // Only track events with realized PnL
                cumulativePnl += pnl;
                labels.push(formatToUTC8(fill.time).split(' ')[0]); // Just date for x-axis
                dataPoints.push(cumulativePnl);
            }
        });

        setPnlData({
            labels,
            datasets: [
                {
                    label: 'Cumulative PnL (Last 60 Days)',
                    data: dataPoints,
                    borderColor: (context) => {
                        const chart = context.chart;
                        const { ctx, chartArea, scales } = chart;
                        if (!chartArea) return null;

                        const yAxis = scales.y;
                        const yZero = yAxis.getPixelForValue(0);
                        const top = chartArea.top;
                        const bottom = chartArea.bottom;

                        const gradient = ctx.createLinearGradient(0, top, 0, bottom);

                        let ratio = (yZero - top) / (bottom - top);
                        if (ratio < 0) ratio = 0;
                        if (ratio > 1) ratio = 1;

                        gradient.addColorStop(0, '#0ecb81');
                        gradient.addColorStop(ratio, '#0ecb81');
                        gradient.addColorStop(ratio, '#f6465d');
                        gradient.addColorStop(1, '#f6465d');

                        return gradient;
                    },
                    fill: {
                        target: 'origin',
                        above: 'rgba(14, 203, 129, 0.2)',
                        below: 'rgba(246, 70, 93, 0.2)'
                    },
                    tension: 0.4,
                    pointRadius: 2,
                }
            ]
        });
    };

    const renderTable = (data, type) => {
        return (
            <div style={{ overflowX: 'auto', width: '100%' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px', fontSize: '14px', tableLayout: 'fixed' }}>
                    <thead>
                        <tr style={{ borderBottom: '2px solid #ddd', textAlign: 'left', backgroundColor: '#f9f9f9' }}>
                            <th style={{ padding: '10px', width: '10%' }}>Time (UTC+8)</th>
                            <th style={{ padding: '10px', width: '8%' }}>Symbol</th>
                            <th style={{ padding: '10px', width: '6%' }}>Side</th>
                            <th style={{ padding: '10px', width: '8%' }}>Type</th>
                            <th style={{ padding: '10px', width: '10%' }}>Price</th>
                            <th style={{ padding: '10px', width: '10%' }}>Size</th>
                            <th style={{ padding: '10px', width: '8%' }}>Value ($)</th>
                            {type === 'history' && <th style={{ padding: '10px', width: '8%' }}>Fee</th>}
                            {type === 'history' && <th style={{ padding: '10px', width: '8%' }}>PnL</th>}
                            <th style={{ padding: '10px', width: '8%' }}>OID</th>
                            <th style={{ padding: '10px', width: '8%' }}>CLOID</th>
                            <th style={{ padding: '10px', width: '8%' }}>Source</th>
                            {type === 'history' && <th style={{ padding: '10px', width: '8%' }}>Hash</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {(!data || data.length === 0) ? (
                            <tr>
                                <td colSpan={type === 'history' ? 13 : 10} style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                                    No records found
                                </td>
                            </tr>
                        ) : (
                            data.map((item, index) => {
                                const isHistory = type === 'history';
                                const timestamp = isHistory ? item.time : item.timestamp;
                                const side = item.side === 'A' ? 'Sell' : 'Buy';
                                const sideColor = item.side === 'B' ? '#0ecb81' : '#f6465d';
                                const sideText = item.side === 'B' ? 'Buy' : 'Sell';

                                const price = isHistory ? item.px : item.limitPx;
                                const size = isHistory ? item.sz : item.sz;
                                const value = (parseFloat(price) * parseFloat(size)).toFixed(2);

                                // CLOID handling
                                const cloid = item.cloid || '';
                                const displayCloid = cloid ? `${cloid.substring(0, 4)}...${cloid.substring(cloid.length - 4)}` : '-';

                                // Source identification
                                const isBased = cloid === '0xba5ed11067f2cc02ba5ed10000ba5ed1';
                                const source = isBased ? 'Based' : '-';

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
                                        <td style={{ padding: '10px' }} title={item.oid}>{item.oid ? item.oid.toString().substring(0, 8) + '...' : '-'}</td>
                                        <td style={{ padding: '10px' }} title={cloid}>{displayCloid}</td>
                                        <td style={{ padding: '10px' }}>{source}</td>
                                        {isHistory && (
                                            <td style={{ padding: '10px' }}>
                                                {item.hash ? (
                                                    <a
                                                        href={`https://app.hyperliquid.xyz/explorer/tx/${item.hash}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        style={{ color: '#f0ad4e', textDecoration: 'none' }}
                                                    >
                                                        {item.hash.substring(0, 4)}...{item.hash.substring(item.hash.length - 4)}
                                                    </a>
                                                ) : '-'}
                                            </td>
                                        )}
                                    </tr>
                                );
                            })
                        )}
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

            {(hasFetched || activeOrders.length > 0 || childrenOrders.length > 0 || historyData.length > 0) && (
                <div style={{ margin: '0', backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
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
                        {pnlData && (
                            <div style={{ marginBottom: '30px', padding: '20px', backgroundColor: '#fdfdfd', borderRadius: '8px', border: '1px solid #eee' }}>
                                <h4 style={{ margin: '0 0 15px 0', color: '#555' }}>PnL Analysis (Last 60 Days)</h4>
                                <div style={{ height: '300px' }}>
                                    <Line
                                        data={pnlData}
                                        options={{
                                            responsive: true,
                                            maintainAspectRatio: false,
                                            plugins: {
                                                legend: { position: 'top' },
                                                tooltip: {
                                                    callbacks: {
                                                        label: function (context) {
                                                            let label = context.dataset.label || '';
                                                            if (label) {
                                                                label += ': ';
                                                            }
                                                            if (context.parsed.y !== null) {
                                                                label += new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(context.parsed.y);
                                                            }
                                                            return label;
                                                        }
                                                    }
                                                }
                                            },
                                            scales: {
                                                x: { ticks: { maxTicksLimit: 10 } },
                                                y: {
                                                    ticks: { callback: (value) => '$' + value },
                                                    grid: { color: '#eee' }
                                                }
                                            }
                                        }}
                                    />
                                </div>
                            </div>
                        )}

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

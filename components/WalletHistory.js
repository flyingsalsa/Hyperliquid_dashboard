'use client';

import { useState } from 'react';

export default function WalletHistory() {
    const [address, setAddress] = useState('');
    const [historyData, setHistoryData] = useState(null);
    const [error, setError] = useState('');

    const formatToUTC8 = (timestamp) => {
        const date = new Date(timestamp);
        // Get UTC+8 time by adding 8 hours
        const utc8Date = new Date(date.getTime() + (8 * 60 * 60 * 1000));
        return utc8Date.toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');
    };

    const convertTimestamps = (obj) => {
        if (Array.isArray(obj)) {
            return obj.map(convertTimestamps);
        } else if (typeof obj === 'object' && obj !== null) {
            const newObj = {};
            for (const key in obj) {
                const value = obj[key];

                // Check if key contains 'time' (case insensitive)
                const isTimeKey = key.toLowerCase().includes('time');
                // Check if value is numeric
                const valNum = Number(value);
                const isNumeric = !isNaN(valNum) && value !== null && value !== '' && typeof value !== 'boolean';

                // Convert if key has "time" and is numeric, OR if value is 13-digit number
                if ((isTimeKey && isNumeric) || (typeof value === 'number' && value.toString().length === 13)) {
                    newObj[key] = formatToUTC8(valNum);
                } else {
                    newObj[key] = convertTimestamps(value);
                }
            }
            return newObj;
        }
        return obj;
    };

    const fetchHistory = async () => {
        if (!address.trim()) {
            alert('Please enter a wallet address');
            return;
        }

        setError('');
        setHistoryData(null);
        console.log('Fetching history for:', address);

        try {
            const response = await fetch('https://api.hyperliquid.xyz/info', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    type: 'userFills',
                    user: address.trim()
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            let data = await response.json();
            data = convertTimestamps(data);
            setHistoryData(data);

        } catch (err) {
            console.error('Error fetching wallet history:', err);
            setError(err.message);
        }
    };

    return (
        <div id="tab2" className="tab-pane active" style={{ display: 'block' }}>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '40px', gap: '10px' }}>
                <input
                    type="text"
                    placeholder="enter wallet address here"
                    className="search-input"
                    style={{ width: '350px' }}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                />
                <button
                    className="action-button"
                    style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #ddd' }}
                    onClick={fetchHistory}
                >
                    Get History
                </button>
            </div>

            {(historyData || error) && (
                <div id="json-result-container" style={{ padding: '20px', textAlign: 'left', maxHeight: '400px', overflowY: 'auto', backgroundColor: '#f4f4f4', borderRadius: '8px', margin: '0 40px' }}>
                    <h3 style={{ marginBottom: '10px', color: '#333' }}>Raw JSON Output:</h3>
                    <pre style={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word', color: '#333', fontFamily: 'monospace', fontSize: '13px' }}>
                        {error ? `Error fetching data: ${error}` : JSON.stringify(historyData, null, 2)}
                    </pre>
                </div>
            )}
        </div>
    );
}

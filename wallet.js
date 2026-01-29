document.addEventListener('DOMContentLoaded', () => {
    console.log('Wallet Tab Script Loaded');

    const walletInput = document.getElementById('wallet-address-input');
    const historyBtn = document.getElementById('get-history-btn');

    if (historyBtn && walletInput) {
        historyBtn.addEventListener('click', async () => {
            const address = walletInput.value.trim();

            if (!address) {
                alert('Please enter a wallet address');
                return;
            }

            console.log('Fetching history for:', address);

            try {
                const response = await fetch('https://api.hyperliquid.xyz/info', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        type: 'userFills',
                        user: address
                    })
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                let data = await response.json();
                console.log('Historical Orders:', data);

                // Helper to format date to UTC+8
                const formatToUTC8 = (timestamp) => {
                    const date = new Date(timestamp);
                    // Get UTC+8 time by adding 8 hours (simple offset for display)
                    const utc8Date = new Date(date.getTime() + (8 * 60 * 60 * 1000));
                    return utc8Date.toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');
                };

                // Recursively convert timestamps
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

                data = convertTimestamps(data);

                const jsonOutput = document.getElementById('json-output');
                if (jsonOutput) {
                    jsonOutput.textContent = JSON.stringify(data, null, 2);
                }

            } catch (error) {
                console.error('Error fetching wallet history:', error);
                const jsonOutput = document.getElementById('json-output');
                if (jsonOutput) {
                    jsonOutput.textContent = 'Error fetching data: ' + error.message;
                }
            }
        });
    }
});

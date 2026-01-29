document.addEventListener('DOMContentLoaded', function () {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabPanes = document.querySelectorAll('.tab-pane');

    // Tab switching logic
    tabButtons.forEach(button => {
        button.addEventListener('click', function () {
            const targetTab = this.getAttribute('data-tab');

            // Remove active class from all buttons and panes
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabPanes.forEach(pane => pane.classList.remove('active'));

            // Add active class to clicked button and corresponding pane
            this.classList.add('active');
            document.getElementById(targetTab).classList.add('active');
        });
    });

    // Funding Rates Logic
    const ratesBody = document.getElementById('rates-body');
    const searchInput = document.getElementById('search-input');
    const lastUpdatedSpan = document.getElementById('last-updated');
    let allRates = [];

    async function fetchRates() {
        try {
            const response = await fetch('/api/funding-rates');
            if (!response.ok) throw new Error('Network response was not ok');

            allRates = await response.json();

            // Sort by 24h Quote Volume (descending) by default
            allRates.sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume));

            renderRates(allRates);

            // Update timestamp
            if (lastUpdatedSpan) {
                const now = new Date();
                lastUpdatedSpan.textContent = `Last updated: ${now.toLocaleTimeString()}`;
            }
        } catch (error) {
            console.error('Error:', error);
            ratesBody.innerHTML = '<tr><td colspan="5" class="loading-message">Error loading data. Please try again.</td></tr>';
        }
    }

    function formatVolume(volume) {
        const val = parseFloat(volume);
        if (val >= 1000000000) return '$' + (val / 1000000000).toFixed(2) + 'B';
        if (val >= 1000000) return '$' + (val / 1000000).toFixed(2) + 'M';
        if (val >= 1000) return '$' + (val / 1000).toFixed(2) + 'K';
        return '$' + val.toFixed(2);
    }

    function renderRates(rates) {
        ratesBody.innerHTML = '';

        if (rates.length === 0) {
            ratesBody.innerHTML = '<tr><td colspan="6" class="loading-message">No matches found</td></tr>';
            return;
        }

        rates.forEach(rate => {
            const tr = document.createElement('tr');

            // Helper to format rate
            const formatRate = (val) => {
                if (val === null || val === undefined) return '-';
                const num = parseFloat(val);
                return (num * 100).toFixed(6) + '%';
            };

            // Helper for color class
            const getRateClass = (val) => {
                if (val === null || val === undefined) return 'neutral-rate';
                const num = parseFloat(val);
                if (num > 0) return 'positive-rate';
                if (num < 0) return 'negative-rate';
                return 'neutral-rate';
            };

            const binanceRateStr = formatRate(rate.binanceRate);
            const binanceClass = getRateClass(rate.binanceRate);

            const bybitRateStr = formatRate(rate.bybitRate);
            const bybitClass = getRateClass(rate.bybitRate);

            const hlRateStr = formatRate(rate.hlRate);
            const hlClass = getRateClass(rate.hlRate);

            tr.innerHTML = `
                <td>${rate.symbol}</td>
                <td>${parseFloat(rate.markPrice || rate.price).toFixed(2)}</td>
                <td>${formatVolume(rate.quoteVolume || rate.volume)}</td>
                <td class="${binanceClass}">${binanceRateStr}</td>
                <td class="${bybitClass}">${bybitRateStr}</td>
                <td class="${hlClass}">${hlRateStr}</td>
            `;
            ratesBody.appendChild(tr);
        });
    }

    // Search functionality
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toUpperCase();
            const filtered = allRates.filter(rate => rate.symbol.includes(searchTerm));
            renderRates(filtered);
        });
    }

    // Initial fetch
    fetchRates();

    // Auto-refresh every 60 seconds
    setInterval(fetchRates, 60000);
});

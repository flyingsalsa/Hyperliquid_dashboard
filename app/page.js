'use client';

import { useState } from 'react';
import FundingTable from '@/components/FundingTable';
import WalletHistory from '@/components/WalletHistory';

export default function Home() {
  const [activeTab, setActiveTab] = useState('tab1'); // Default to Wallet History as per latest user config

  return (
    <main>
      <div className="dashboard-container">
        <div className="tabs">
          <button
            className={`tab-button ${activeTab === 'tab1' ? 'active' : ''}`}
            onClick={() => setActiveTab('tab1')}
          >
            Wallet History
          </button>
          <button
            className={`tab-button ${activeTab === 'tab2' ? 'active' : ''}`}
            onClick={() => setActiveTab('tab2')}
          >
            Funding Rates
          </button>
        </div>
        <div className="tab-content">
          {activeTab === 'tab1' && <WalletHistory />}
          {activeTab === 'tab2' && <FundingTable />}
        </div>
      </div>
    </main>
  );
}

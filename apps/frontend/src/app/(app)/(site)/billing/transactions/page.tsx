import React from 'react';
import { TransactionHistoryComponent } from '@gitroom/frontend/components/billing/transaction.history.component';

export default function TransactionHistoryPage() {
  return (
    <div className="w-full max-w-6xl mx-auto p-6">
      <TransactionHistoryComponent />
    </div>
  );
}
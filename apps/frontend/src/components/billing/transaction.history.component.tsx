'use client';

import React, { FC, useEffect, useState } from 'react';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import dayjs from 'dayjs';
import clsx from 'clsx';
import { TopTitle } from '@gitroom/frontend/components/launches/helpers/top.title.component';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { useRouter } from 'next/navigation';
import { Button } from '@gitroom/react/form/button';

interface Transaction {
  id: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'REFUNDED' | 'PARTIALLY_REFUNDED';
  provider: 'RAZORPAY' | 'PAYPAL' | 'STRIPE' | 'MANUAL';
  providerTransactionId: string | null;
  paymentMethod: string | null;
  type: 'SUBSCRIPTION_PAYMENT' | 'UPGRADE_PAYMENT' | 'DOWNGRADE_CREDIT' | 'REFUND' | 'MANUAL_ADJUSTMENT';
  description: string | null;
  failureReason: string | null;
  createdAt: string;
  processedAt: string | null;
  subscription: {
    id: string;
    subscriptionTier: string;
    period: 'MONTHLY' | 'YEARLY';
  } | null;
}

export const TransactionHistoryComponent: FC = () => {
  const fetch = useFetch();
  const t = useT();
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const goBack = () => {
    router.push('/billing');
  };

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const response = await fetch('/billing/transactions');
        const data = await response.json();
        console.log('Transaction data:', data); // Debug log
        setTransactions(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Error fetching transaction history:', err);
        setError('Failed to load transaction history');
        setTransactions([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, []);

  const getStatusBadge = (status: Transaction['status']) => {
    const statusClasses = {
      PENDING: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
      PROCESSING: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
      SUCCEEDED: 'bg-green-500/10 text-green-600 border-green-500/20',
      FAILED: 'bg-red-500/10 text-red-600 border-red-500/20',
      CANCELLED: 'bg-gray-500/10 text-gray-600 border-gray-500/20',
      REFUNDED: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
      PARTIALLY_REFUNDED: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
    };

    return (
      <span className={clsx(
        'px-2 py-1 rounded-full text-xs font-medium border',
        statusClasses[status]
      )}>
        {status}
      </span>
    );
  };

  const getTypeLabel = (type: Transaction['type']) => {
    const typeLabels = {
      SUBSCRIPTION_PAYMENT: 'Subscription Payment',
      UPGRADE_PAYMENT: 'Upgrade Payment',
      DOWNGRADE_CREDIT: 'Downgrade Credit',
      REFUND: 'Refund',
      MANUAL_ADJUSTMENT: 'Manual Adjustment',
    };
    return typeLabels[type] || type;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-customColor68"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[16px]">
      <div className="flex items-center gap-4 mb-6">
        <Button onClick={goBack} className="flex items-center gap-2">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M20 12H4M4 12L10 18M4 12L10 6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {t('back_to_billing', 'Back to Billing')}
        </Button>
      </div>
      <TopTitle title={t('transaction_history', 'Transaction History')} />
      <div className="bg-sixth border border-customColor6 rounded-lg overflow-hidden">
        <div className="p-6 border-b border-customColor6">
          <h3 className="text-lg font-medium text-textColor">
            {t('your_payment_history', 'Your Payment History')}
          </h3>
          <p className="text-sm text-customColor18 mt-1">
            {t('view_all_your_past_transactions', 'View all your past transactions and payment details')}
          </p>
        </div>

        <div className="p-6">
          {transactions.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-4">💳</div>
              <h3 className="text-lg font-medium text-textColor mb-2">
                {t('no_transactions_yet', 'No transactions yet')}
              </h3>
              <p className="text-sm text-customColor18">
                {t('your_transaction_history_will_appear_here', 'Your transaction history will appear here once you make payments')}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {transactions.map((transaction: Transaction) => (
                <div
                  key={transaction.id}
                  className="p-4 bg-customColor2 rounded-lg border border-customColor6 hover:border-customColor9 transition-colors"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-medium text-textColor">
                          {getTypeLabel(transaction.type)}
                        </h4>
                        {getStatusBadge(transaction.status)}
                      </div>
                      <div className="text-sm text-customColor18 space-y-1">
                        {transaction.description && (
                          <p>{transaction.description}</p>
                        )}
                        {transaction.subscription && (
                          <p>
                            Plan: {transaction.subscription.subscriptionTier} ({transaction.subscription.period})
                          </p>
                        )}
                        {transaction.paymentMethod && (
                          <p>Method: {transaction.paymentMethod}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold text-textColor">
                        ${(transaction.amount / 100).toFixed(2)}
                      </div>
                      <div className="text-sm text-customColor18">
                        {transaction.createdAt ? dayjs(transaction.createdAt).format('MMM D, YYYY') : 'N/A'}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-3 border-t border-customColor6">
                    <div className="text-sm text-customColor18">
                      {transaction.provider && (
                        <span className="inline-flex items-center gap-1">
                          <span className="font-medium capitalize">{transaction.provider.toLowerCase()}</span>
                          {transaction.providerTransactionId && (
                            <span className="text-xs">• {transaction.providerTransactionId}</span>
                          )}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-customColor18">
                      {transaction.processedAt ? dayjs(transaction.processedAt).format('MMM D, YYYY hh:mm A') : 'Not processed yet'}
                    </div>
                  </div>

                  {transaction.failureReason && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-600">
                        <span className="font-medium">{t('failure_reason', 'Reason for failure')}:</span> {transaction.failureReason}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
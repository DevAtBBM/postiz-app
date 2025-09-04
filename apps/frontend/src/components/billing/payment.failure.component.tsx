'use client';

import React, { FC, useEffect, useState } from 'react';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useRouter } from 'next/navigation';
import dayjs from 'dayjs';
import clsx from 'clsx';
import { TopTitle } from '@gitroom/frontend/components/launches/helpers/top.title.component';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { Button } from '@gitroom/react/form/button';

interface FailedPayment {
  id: string;
  amount: number;
  currency: string;
  provider: string;
  providerTransactionId: string;
  failureReason: string;
  createdAt: string;
  subscription?: {
    id: string;
    subscriptionTier: string;
  };
}

export const PaymentFailureComponent: FC = () => {
  const fetch = useFetch();
  const router = useRouter();
  const t = useT();
  const [failedPayments, setFailedPayments] = useState<FailedPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFailedPayments = async () => {
      try {
        const response = await fetch('/billing/failed-payments');
        const data = await response.json();
        setFailedPayments(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Error fetching failed payments:', err);
        setError('Failed to load failed payments');
        setFailedPayments([]);
      } finally {
        setLoading(false);
      }
    };

    fetchFailedPayments();
  }, []);

  const retryPayment = async (paymentId: string) => {
    try {
      await fetch('/billing/retry-payment', {
        method: 'POST',
        body: JSON.stringify({ paymentId }),
        headers: { 'Content-Type': 'application/json' },
      });
      // Refresh the list
      window.location.reload();
    } catch (err) {
      console.error('Error retrying payment:', err);
    }
  };

  const updatePaymentMethod = () => {
    router.push('/billing');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-customColor68"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[16px]">
      <div className="flex items-center gap-4 mb-6">
        <Button onClick={() => router.push('/billing')} className="flex items-center gap-2">
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
      <TopTitle title={t('failed_payments', 'Failed Payments')} />
      <div className="bg-sixth border border-customColor6 rounded-lg overflow-hidden">
        <div className="p-6 border-b border-customColor6">
          <h3 className="text-lg font-medium text-textColor">
            {t('recent_payment_failures', 'Recent Payment Failures')}
          </h3>
          <p className="text-sm text-customColor18 mt-1">
            {t('resolve_failed_payments_description', 'Review and resolve your failed payment attempts')}
          </p>
        </div>

        <div className="p-6">
          {failedPayments.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-4">✅</div>
              <h3 className="text-lg font-medium text-textColor mb-2">
                {t('no_failed_payments', 'No Failed Payments')}
              </h3>
              <p className="text-sm text-customColor18">
                {t('all_payments_successful', 'All your payments have been processed successfully')}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {failedPayments.map((payment: FailedPayment) => (
                <div
                  key={payment.id}
                  className="p-4 bg-red-50 border border-red-200 rounded-lg"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-medium text-textColor">
                          Payment Failure
                        </h4>
                        <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full">
                          Failed
                        </span>
                      </div>
                      <div className="text-sm text-customColor18 space-y-1">
                        <p>{t('amount', 'Amount')}: ${(payment.amount / 100).toFixed(2)} {payment.currency}</p>
                        {payment.subscription && (
                          <p>{t('plan', 'Plan')}: {payment.subscription.subscriptionTier}</p>
                        )}
                        <p>{t('provider', 'Provider')}: {payment.provider}</p>
                        <p className="text-red-600 font-medium">
                          {t('reason', 'Reason')}: {payment.failureReason || 'Unknown failure'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-customColor18">
                        {dayjs(payment.createdAt).format('MMM D, YYYY hh:mm A')}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-3 border-t border-red-200">
                    <Button onClick={() => retryPayment(payment.id)} className="bg-blue-500">
                      {t('retry_payment', 'Retry Payment')}
                    </Button>
                    <Button onClick={updatePaymentMethod}>
                      {t('update_payment_method', 'Update Payment Method')}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
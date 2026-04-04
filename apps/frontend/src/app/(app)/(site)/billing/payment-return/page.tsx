'use client';

import React, { FC, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSWRConfig } from 'swr';

const PaymentReturnComponent: FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { mutate } = useSWRConfig();
  const [status, setStatus] = useState<'loading' | 'success' | 'cancel' | 'error'>('loading');

  useEffect(() => {
    const handlePaymentReturn = async () => {
      try {
        // Check for Razorpay redirect data in localStorage
        const redirectData = localStorage.getItem('razorpay_subscription_redirects');

        if (redirectData) {
          const parsedData = JSON.parse(redirectData);

          // Check subscription status via API
          const statusResponse = await fetch(`/billing/razorpay-redirect?subscription_id=${parsedData.subscriptionId}&org_id=${searchParams.get('org_id') || ''}`);
          const statusData = await statusResponse.json();

          if (statusData.redirectUrl) {
            // Clean up localStorage
            localStorage.removeItem('razorpay_subscription_redirects');

            // Redirect to appropriate page
            window.location.href = statusData.redirectUrl;
            return;
          }

          // Fallback: redirect to billing page if no redirect URL
          window.location.href = '/billing';
          return;
        }

        // Fallback: redirect to billing page
        setStatus('error');
        setTimeout(() => {
          router.push('/billing');
        }, 3000);

      } catch (error) {
        console.error('Error handling payment return:', error);
        setStatus('error');
        setTimeout(() => {
          router.push('/billing');
        }, 3000);
      }
    };

    handlePaymentReturn();
  }, [router, searchParams, mutate]);

  if (status === 'loading') {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-lg">Processing your payment...</p>
          <p className="text-sm text-gray-600 mt-2">Please wait while we verify your subscription.</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <p className="text-lg font-semibold mb-2">Payment Processing Error</p>
          <p className="text-sm text-gray-600 mb-4">
            We encountered an issue processing your payment. Redirecting you back to billing...
          </p>
          <button
            onClick={() => router.push('/billing')}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Go to Billing
          </button>
        </div>
      </div>
    );
  }

  return null;
};

export default PaymentReturnComponent;
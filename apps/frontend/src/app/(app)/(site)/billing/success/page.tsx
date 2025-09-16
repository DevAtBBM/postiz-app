'use client';

import React, { FC, useEffect, useState } from 'react';
import { Button } from '@gitroom/react/form/button';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSWRConfig } from 'swr';
import { TrackEnum } from '@gitroom/nestjs-libraries/user/track.enum';
import { useTrack } from '@gitroom/react/helpers/use.track';
import { useT } from '@gitroom/react/translation/get.transation.service.client';

const SuccessComponent: FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { mutate } = useSWRConfig();
  const track = useTrack();
  const t = useT();
  const [loading, setLoading] = useState(true);

  const subscriptionId = searchParams.get('subscription_id');
  const baToken = searchParams.get('ba_token');
  const token = searchParams.get('token');

  useEffect(() => {
    if (subscriptionId) {
      // Track successful subscription
      track(TrackEnum.Purchase, {
        provider: 'paypal',
        subscriptionId: subscriptionId
      });

      // Refresh user data to get updated subscription status
      mutate('/user/self');

      setLoading(false);
    }
  }, [subscriptionId, mutate]);

  const handleContinue = () => {
    router.push('/billing');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-lg">Processing your subscription...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-50">
      <div className="max-w-md w-full mx-4 bgCustomCss rounded-lg shadow-lg p-8 text-center">
        {/* Success Icon */}
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        {/* Success Message */}
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Payment Successful!
        </h1>

        <p className="text-gray-600 mb-6">
          Your PayPal subscription has been successfully created and is now active.
        </p>

        {/* Subscription Details */}
        <div className="bg-gray-50 rounded-lg py-4 mb-6 text-left">
          <h3 className="font-medium text-gray-900 mb-2">Subscription Details:</h3>
          <div className="text-sm text-gray-600 space-y-1">
            {subscriptionId && (
              <p><span className="font-medium">Subscription ID:</span> {subscriptionId}</p>
            )}
            {baToken && (
              <p><span className="font-medium">Billing Agreement:</span> {baToken}</p>
            )}
          </div>
        </div>

        {/* Next Steps */}
        <div className="text-left mb-6">
          <h3 className="font-medium text-gray-900 mb-3">What happens next:</h3>
          <ul className="text-sm text-gray-600 space-y-2">
            <li>✅ Your subscription is now active</li>
            <li>💳 You'll be billed automatically each month</li>
            <li>📧 Billing receipts will be sent to your email</li>
            <li>🔧 You can manage your subscription anytime from your billing settings</li>
          </ul>
        </div>

        {/* Continue Button */}
        <Button onClick={handleContinue} className="w-full">
          {t('continue_to_billing', 'Continue to Billing')} →
        </Button>

        <p className="text-xs text-gray-500 mt-4">
          You can always manage your subscription from your billing dashboard.
        </p>
      </div>
    </div>
  );
};

export default SuccessComponent;
'use client';

import React, { FC } from 'react';
import { Button } from '@gitroom/react/form/button';
import { useRouter } from 'next/navigation';
import { useT } from '@gitroom/react/translation/get.transation.service.client';

const CancelComponent: FC = () => {
  const router = useRouter();
  const t = useT();

  const handleGoBack = () => {
    router.push('/billing');
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-50">
      <div className="max-w-md w-full mx-4 bg-white rounded-lg shadow-lg p-8 text-center">
        {/* Cancel Icon */}
        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>

        {/* Cancel Message */}
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Payment Cancelled
        </h1>

        <p className="text-gray-600 mb-6">
          The payment process was cancelled. No charges were made to your account.
        </p>

        {/* Explanation */}
        <div className="bg-your-50 rounded-lg p-4 mb-6 text-left">
          <h3 className="font-medium text-gray-900 mb-2">What does this mean:</h3>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• Your PayPal account was not charged</li>
            <li>• No subscription was created</li>
            <li>• You can try again whenever you want</li>
            <li>• Your account remains unchanged</li>
          </ul>
        </div>

        {/* Reasons to Subscribe */}
        <div className="text-left mb-6">
          <h3 className="font-medium text-gray-900 mb-2">
            {t('why_upgrade', 'Why upgrade your plan?')}
          </h3>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>✓ Post unlimited content to social media</li>
            <li>✓ AI-powered writing and imagery</li>
            <li>✓ Schedule posts for optimal engagement</li>
            <li>✓ Advanced analytics and reporting</li>
          </ul>
        </div>

        {/* Go Back Button */}
        <Button onClick={handleGoBack} className="w-full">
          {t('back_to_plans', 'Back to Plans')} ←
        </Button>

        <p className="text-xs text-gray-500 mt-4">
          Questions? Contact our support team for help choosing the right plan.
        </p>
      </div>
    </div>
  );
};

export default CancelComponent;
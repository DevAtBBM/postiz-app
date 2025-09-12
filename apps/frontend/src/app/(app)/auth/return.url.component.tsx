'use client';

import { useSearchParams } from 'next/navigation';
import { FC, useCallback, useEffect } from 'react';
const ReturnUrlComponent: FC = () => {
  const params = useSearchParams();
  const url = params.get('returnUrl');
  useEffect(() => {
    // Only set returnUrl for external URLs, not for auth-related params
    if (url?.indexOf?.('http')! > -1 && !url.includes('referral=') && !url.includes('plan=')) {
      localStorage.setItem('returnUrl', url!);
    } else if (url && (url.includes('referral=') || url.includes('plan='))) {
      // Clear any existing returnUrl if we have referral/plan params
      localStorage.removeItem('returnUrl');
    }
  }, [url]);
  return null;
};
export const useReturnUrl = () => {
  return {
    getAndClear: useCallback(() => {
      const data = localStorage.getItem('returnUrl');
      localStorage.removeItem('returnUrl');
      return data;
    }, []),
  };
};
export default ReturnUrlComponent;

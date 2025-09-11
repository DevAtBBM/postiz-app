'use client';

import { useCallback } from 'react';
import { deleteDialog } from '@gitroom/react/helpers/delete.dialog';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { setCookie } from '@gitroom/frontend/components/layout/layout.context';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
export const LogoutComponent = () => {
  const fetch = useFetch();
  const { isGeneral, isSecured } = useVariables();
  const t = useT();

  const logout = useCallback(async () => {
    if (
      await deleteDialog(
        t(
          'are_you_sure_you_want_to_logout',
          'Are you sure you want to logout?'
        ),
        t('yes_logout', 'Yes logout')
      )
    ) {

      // Fallback to frontend method if backend fails
      if (!isSecured) {
        try {
          const hostname = window.location.hostname;

          // Clear cookies on both domains to handle historical cookie inconsistencies
          // 1. On the current hostname (e.g., stageapp.postnify.com)
          setCookie('auth', '', -10, hostname, isSecured);
          setCookie('showorg', '', -10, hostname, isSecured);
          setCookie('impersonate', '', -10, hostname, isSecured);

          // 2. On the root domain if it exists (e.g., .postnify.com)
          if (hostname.includes('.')) {
            const parts = hostname.split('.');
            if (parts.length > 1) {
              const rootDomain = '.' + parts.slice(-2).join('.');
              setCookie('auth', '', -10, rootDomain, isSecured);
              setCookie('showorg', '', -10, rootDomain, isSecured);
              setCookie('impersonate', '', -10, rootDomain, isSecured);
            }
          }
        } catch (error) {
          console.error('Frontend logout failed:', error);
        }
      }
      // Try backend logout first, as it's more reliable
      try {
        const response = await fetch('/user/logout', {
          method: 'POST',
          credentials: 'include', // Include cookies in the request
        });
        if (response.ok) {
          window.location.href = '/auth/login';
          return;
        }
      } catch (error) {
        console.warn('LOGOUT: Backend logout failed, falling back to frontend method:', error);
      }


      
      window.location.href = '/auth/login';
    }
  }, [isSecured]);
  return (
    <div className="text-red-400 cursor-pointer" onClick={logout}>
      {t('logout_from', 'Logout from')}
      {isGeneral ? ' Postnify' : ' Gitroom'}
    </div>
  );
};

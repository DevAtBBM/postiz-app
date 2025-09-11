'use client';

import { ReactNode, useCallback } from 'react';
import { FetchWrapperComponent } from '@gitroom/helpers/utils/custom.fetch';
import { deleteDialog } from '@gitroom/react/helpers/delete.dialog';
import { useReturnUrl } from '@gitroom/frontend/app/(app)/auth/return.url.component';
import { useVariables } from '@gitroom/react/helpers/variable.context';
export default function LayoutContext(params: { children: ReactNode }) {
  if (params?.children) {
    // eslint-disable-next-line react/no-children-prop
    return <LayoutContextInner children={params.children} />;
  }
  return <></>;
}
export function setCookie(cname: string, cvalue: string, exdays: number, domain?: string, isSecured?: boolean) {
  if (typeof document === 'undefined') {
    return;
  }
  const d = new Date();
  d.setTime(d.getTime() + exdays * 24 * 60 * 60 * 1000);
  let cookieString = cname + '=' + cvalue + ';';

  if (domain) {
    cookieString += 'domain=' + domain + ';';
  }

  cookieString += 'path=/;';

  if (isSecured !== undefined && !isSecured) {
    // For non-secured environments, we don't add security flags
  } else if (isSecured) {
    cookieString += 'secure=true;sameSite=none;httpOnly=true;';
  }

  cookieString += 'expires=' + d.toUTCString();

  document.cookie = cookieString;
}
function LayoutContextInner(params: { children: ReactNode }) {
  const returnUrl = useReturnUrl();
  const { backendUrl, isGeneral, isSecured } = useVariables();
  const afterRequest = useCallback(
    async (url: string, options: RequestInit, response: Response) => {
      if (
        typeof window !== 'undefined' &&
        window.location.href.includes('/p/')
      ) {
        return true;
      }
      const headerAuth =
        response?.headers?.get('auth') || response?.headers?.get('Auth');
      const showOrg =
        response?.headers?.get('showorg') || response?.headers?.get('Showorg');
      const impersonate =
        response?.headers?.get('impersonate') ||
        response?.headers?.get('Impersonate');
      const logout =
        response?.headers?.get('logout') || response?.headers?.get('Logout');
      if (headerAuth) {
        //setCookie('auth', headerAuth, 365);
      }
      if (showOrg) {
        setCookie('showorg', showOrg, 365);
      }
      if (impersonate) {
        setCookie('impersonate', impersonate, 365);
      }
      console.log('Server logout value:', logout);
      if (logout && !isSecured) {
        // Extract domain for cookie clearing - use current hostname
        const hostname = window.location.hostname;
        let domain = hostname;

        // For production domains like "stageapp.postnify.com", we want ".postnify.com"
        // For local localhost, we want "localhost"
        if (hostname.includes('.')) {
          // For .com, .net, etc. domains, get the domain part
          const parts = hostname.split('.');
          if (parts.length > 1) {
            domain = '.' + parts.slice(-2).join('.');
          }
        }

        setCookie('auth', '', -10, domain, isSecured);
        setCookie('auth', '', -10, "stageapp.postnify.com", isSecured);
        setCookie('showorg', '', -10, domain, isSecured);
        setCookie('impersonate', '', -10, domain, isSecured);
        console.log('Server-directed logout for domain:', domain);
        // Using document.cookie directly
        document.cookie = "auth=; expires=Thu, 01 Jan 1970 00:00:00 UTC; domain=stageapp.postnify.com; path=/; secure=" + (isSecured ? "true" : "false");
        window.location.href = '/auth/login';
        return true;
      }
      const reloadOrOnboarding =
        response?.headers?.get('reload') ||
        response?.headers?.get('onboarding');
      if (reloadOrOnboarding) {
        const getAndClear = returnUrl.getAndClear();
        if (getAndClear) {
          window.location.href = getAndClear;
          return true;
        }
      }
      if (response?.headers?.get('onboarding')) {
        window.location.href = isGeneral
          ? '/launches?onboarding=true'
          : '/analytics?onboarding=true';
        return true;
      }
      if (response?.headers?.get('reload')) {
        window.location.reload();
        return true;
      }
      if (response.status === 401) {
        if (!isSecured) {
          // Extract domain for cookie clearing - use current hostname
          const hostname = window.location.hostname;
          let domain = hostname;

          // For production domains like "stageapp.postnify.com", we want ".postnify.com"
          // For local localhost, we want "localhost"
          if (hostname.includes('.')) {
            // For .com, .net, etc. domains, get the domain part
            const parts = hostname.split('.');
            if (parts.length > 1) {
              domain = '.' + parts.slice(-2).join('.');
            }
          }

          setCookie('auth', '', -10, domain, isSecured);
          setCookie('showorg', '', -10, domain, isSecured);
          setCookie('impersonate', '', -10, domain, isSecured);
          console.log('401 error logout for domain:', domain);
        }
        window.location.href = '/auth/login';
      }
      if (response.status === 406) {
        if (
          await deleteDialog(
            'You are currently on trial, in order to use the feature you must finish the trial',
            'Finish the trial, charge me now',
            'Trial',

          )
        ) {
          window.open('/billing?finishTrial=true', '_blank');
          return false;
        }
        return false;
      }

      if (response.status === 402) {
        if (
          await deleteDialog(
            (
              await response.json()
            ).message,
            'Move to billing',
            'Payment Required'
          )
        ) {
          window.open('/billing', '_blank');
          return false;
        }
        return true;
      }
      return true;
    },
    []
  );
  return (
    <FetchWrapperComponent baseUrl={backendUrl} afterRequest={afterRequest}>
      {params?.children || <></>}
    </FetchWrapperComponent>
  );
}

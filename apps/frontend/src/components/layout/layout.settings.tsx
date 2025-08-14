'use client';

import { ReactNode, useCallback, useEffect } from 'react';
import { Title } from '@gitroom/frontend/components/layout/title';
import { ContextWrapper } from '@gitroom/frontend/components/layout/user.context';
import { TopMenu } from '@gitroom/frontend/components/layout/top.menu';
import { MantineWrapper } from '@gitroom/react/helpers/mantine.wrapper';
import { ToolTip } from '@gitroom/frontend/components/layout/top.tip';
import { ShowMediaBoxModal } from '@gitroom/frontend/components/media/media.component';
import Image from 'next/image';
import { Toaster, useToaster } from '@gitroom/react/toaster/toaster';
import { ShowPostSelector } from '@gitroom/frontend/components/post-url-selector/post.url.selector';
import { OrganizationSelector } from '@gitroom/frontend/components/layout/organization.selector';
import NotificationComponent from '@gitroom/frontend/components/notifications/notification.component';
import Link from 'next/link';
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import utc from 'dayjs/plugin/utc';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import isoWeek from 'dayjs/plugin/isoWeek';
import isBetween from 'dayjs/plugin/isBetween';
import { ShowLinkedinCompany } from '@gitroom/frontend/components/launches/helpers/linkedin.component';
import { SettingsComponent } from '@gitroom/frontend/components/layout/settings.component';
import { Onboarding } from '@gitroom/frontend/components/onboarding/onboarding';
import { Support } from '@gitroom/frontend/components/layout/support';
import { ContinueProvider } from '@gitroom/frontend/components/layout/continue.provider';
import { CopilotKit } from '@copilotkit/react-core';
import { Impersonate } from '@gitroom/frontend/components/layout/impersonate';
import clsx from 'clsx';
import { BillingComponent } from '@gitroom/frontend/components/billing/billing.component';
import dynamic from 'next/dynamic';
import { NewSubscription } from '@gitroom/frontend/components/layout/new.subscription';
import { useVariables } from '@gitroom/react/helpers/variable.context';
const ModeComponent = dynamic(
  () => import('@gitroom/frontend/components/layout/mode.component'),
  {
    ssr: false,
  }
);
import { extend } from 'dayjs';
import { useSearchParams } from 'next/navigation';
import { CheckPayment } from '@gitroom/frontend/components/layout/check.payment';
import { ChromeExtensionComponent } from '@gitroom/frontend/components/layout/chrome.extension.component';
import { LanguageComponent } from '@gitroom/frontend/components/layout/language.component';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import i18next from '@gitroom/react/translation/i18next';
import { MediaSettingsLayout } from '@gitroom/frontend/components/launches/helpers/media.settings.component';
extend(utc);
extend(weekOfYear);
extend(isoWeek);
extend(isBetween);
export const LayoutSettings = ({ children }: { children: ReactNode }) => {
  const fetch = useFetch();
  const t = useT();

  const { isGeneral } = useVariables();
  const { backendUrl, billingEnabled } = useVariables();
  const searchParams = useSearchParams();
  const load = useCallback(async (path: string) => {
    return await (await fetch(path)).json();
  }, []);
  const { data: user, mutate } = useSWR('/user/self', load, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    refreshWhenOffline: false,
    refreshWhenHidden: false,
  });
  if (!user) return null;
  return (
    <ContextWrapper user={user}>
      <CopilotKit
        credentials="include"
        runtimeUrl={backendUrl + '/copilot/chat'}
      >
        <MantineWrapper>
          {user.tier === 'FREE' && searchParams.get('check') && (
            <CheckPayment check={searchParams.get('check')!} mutate={mutate} />
          )}
          <ToolTip />
          <ShowMediaBoxModal />
          <ShowLinkedinCompany />
          <MediaSettingsLayout />
          <Toaster />
          <ShowPostSelector />
          <NewSubscription />
          {user.tier !== 'FREE' && <Onboarding />}
          <Support />
          <ContinueProvider />
          <div className="min-h-[100vh] w-full max-w-[1440px] mx-auto bg-primary px-6 text-textColor flex flex-col">
            {user?.admin && <Impersonate />}
            <nav className="flex items-center justify-between">
              <Link
                href="/"
                className="text-2xl flex items-center gap-[10px] text-textColor order-1"
              >
                <div className="min-w-[55px]">
                  <Image
                    src={isGeneral ? '/postnify.svg' : '/logo.svg'}
                    width={55}
                    height={53}
                    alt="Logo"
                  />
                </div>
                <div
                  className={clsx(!isGeneral ? 'mt-[12px]' : 'min-w-[80px]')}
                >
                  {isGeneral ? (
                    <svg width="80" height="75" viewBox="0 0 366 167" fill="none" xmlns="http://www.w3.org/2000/svg">
                    
                    <path d="M51.12 68.998C51.12 85.012 40.614 93.172 26.13 93.172H18.072V115C15.42 115.51 12.156 115.612 9.912 115.612C7.974 115.612 4.404 115.51 1.752 115V45.844L2.466 45.13C11.238 44.926 18.378 44.722 26.13 44.722C40.614 44.722 51.12 52.474 51.12 68.998ZM18.072 57.166V80.932C20.928 80.83 23.682 80.728 24.804 80.728C32.862 80.728 34.494 73.894 34.494 68.998C34.494 64.204 32.862 57.268 24.804 57.268C22.662 57.268 20.826 57.268 18.072 57.166ZM101.858 89.5C101.858 98.476 99.9198 105.106 94.5138 110.512C90.2298 114.694 84.6198 116.53 78.2958 116.53C71.8698 116.53 66.2598 114.694 62.0778 110.512C56.6718 105.106 54.7338 98.476 54.7338 89.5C54.7338 80.626 56.6718 73.996 62.0778 68.59C66.2598 64.408 71.8698 62.572 78.2958 62.572C84.6198 62.572 90.2298 64.408 94.5138 68.59C99.9198 73.996 101.858 80.626 101.858 89.5ZM71.0538 89.5C71.0538 97.966 71.9718 104.596 78.2958 104.596C84.5178 104.596 85.4358 97.966 85.4358 89.5C85.4358 81.136 84.5178 74.506 78.2958 74.506C71.9718 74.506 71.0538 81.136 71.0538 89.5ZM107.005 111.532C107.107 108.064 109.045 103.168 111.391 100.72C115.879 103.066 121.489 105.004 125.569 105.004C129.445 105.004 131.485 103.474 131.485 101.434C131.485 99.496 130.159 97.966 126.793 96.844L121.183 94.702C114.043 92.05 108.433 87.664 108.433 79.402C108.433 69.1 116.185 62.572 128.221 62.572C134.341 62.572 142.501 64.612 146.989 66.856C147.193 70.63 145.153 76.036 142.603 77.974C138.319 76.036 133.219 74.098 128.323 74.098C125.569 74.098 124.141 75.526 124.141 77.362C124.141 79.096 125.263 80.218 128.017 81.238L134.341 83.482C142.093 86.236 147.907 91.234 147.907 99.904C147.907 110.104 139.747 116.53 127.303 116.53C119.347 116.53 111.697 114.184 107.005 111.532ZM186.092 64C186.5 65.938 186.704 67.774 186.704 69.508C186.704 71.548 186.5 73.486 186.092 75.322L173.954 75.118V98.578C173.954 101.638 175.28 103.372 178.442 103.372H184.154C184.97 105.616 185.48 108.472 185.48 110.92C185.48 112.144 185.378 113.47 185.072 114.49C181.298 115 175.892 115.51 171.914 115.51C162.632 115.51 158.348 111.022 158.348 101.332V75.22L150.392 75.322C149.881 73.486 149.677 71.548 149.677 69.508C149.677 67.774 149.881 65.938 150.392 64L158.348 64.204V58.288C158.348 51.25 160.796 48.7 167.018 48.7H173.24L173.954 49.414V64.204L186.092 64ZM238.418 81.34V102.25C238.418 106.228 239.03 109.798 240.865 112.348C238.52 114.388 234.95 115.816 230.972 115.816C224.546 115.816 222.404 112.348 222.404 105.922V84.196C222.404 79.606 221.486 77.464 218.018 77.464C215.978 77.464 213.122 78.484 210.47 80.932V115C208.226 115.408 205.268 115.612 202.514 115.612C199.862 115.612 196.802 115.408 194.558 115V64.102L195.272 63.388H201.29C205.574 63.388 208.328 65.632 209.654 69.508C213.632 65.938 218.222 63.184 224.138 63.184C233.42 63.184 238.418 70.732 238.418 81.34ZM249.625 49.516C249.625 47.578 250.033 45.436 250.849 43.6C252.583 42.682 255.643 41.968 258.397 41.968C261.151 41.968 264.415 42.682 265.945 43.6C266.761 45.436 267.169 47.68 267.169 49.516C267.169 51.352 266.761 53.596 265.945 55.432C264.415 56.248 261.151 56.962 258.397 56.962C255.643 56.962 252.379 56.35 250.849 55.432C250.033 53.596 249.625 51.352 249.625 49.516ZM268.699 75.832V115C266.455 115.408 263.395 115.612 260.641 115.612C257.989 115.612 255.031 115.408 252.685 115V81.238C252.685 77.872 251.461 75.322 247.891 75.322H246.361C245.851 73.588 245.749 71.854 245.749 69.916C245.749 68.182 245.851 66.04 246.361 64.204C249.523 63.898 253.093 63.694 255.337 63.694H257.581C264.313 63.694 268.699 68.386 268.699 75.832ZM283.078 115V75.22L274.306 75.322C273.898 73.588 273.694 71.344 273.694 69.508C273.694 67.774 273.898 65.734 274.306 64L282.262 64.102C281.956 61.858 281.752 59.614 281.752 57.268C281.752 47.17 288.892 39.52 299.5 39.52C305.926 39.52 311.638 41.05 315.208 42.376C315.31 45.946 313.78 50.74 311.74 52.882C309.7 52.27 306.64 51.454 303.886 51.454C299.5 51.454 297.052 53.8 297.052 58.492C297.052 60.226 297.154 62.164 297.46 64.204L310.822 64C311.23 65.734 311.434 67.774 311.434 69.508C311.434 71.344 311.23 73.588 310.822 75.322L298.582 75.118V115C296.236 115.408 293.38 115.612 290.728 115.612C288.178 115.612 285.526 115.408 283.078 115ZM364.329 65.734L351.783 113.674C348.111 127.546 342.603 137.338 326.691 137.338C322.611 137.338 317.103 136.216 314.349 135.298C313.941 131.626 315.369 126.322 317.511 123.874C319.653 124.588 323.325 125.404 326.691 125.404C331.791 125.404 335.157 122.344 336.687 117.142L337.095 115.714C331.587 115.714 327.813 114.082 326.487 109.288L314.655 65.326C317.817 63.898 321.795 63.184 324.447 63.184C328.323 63.184 330.873 64.714 332.199 70.018L336.891 89.602C337.809 93.07 338.727 99.7 339.237 103.066C339.339 103.678 339.543 103.78 340.053 103.78L348.927 64.204C350.661 63.694 353.211 63.49 355.251 63.49C357.903 63.49 360.861 63.694 363.717 64.612L364.329 65.734Z" fill="currentColor" />
                    
                    </svg>
                  ) : (
                    'Gitroom'
                  )}
                </div>
              </Link>
              {user?.orgId &&
              (user.tier !== 'FREE' || !isGeneral || !billingEnabled) ? (
                <TopMenu />
              ) : (
                <></>
              )}
              <div
                id="systray-buttons"
                className="flex items-center justify-self-end gap-[8px] order-2 md:order-3"
              >
                <LanguageComponent />
                <ChromeExtensionComponent />
                <ModeComponent />
                <SettingsComponent />
                <NotificationComponent />
                <OrganizationSelector />
              </div>
            </nav>
            <div className="flex-1 flex">
              <div className="flex-1 rounded-3xl px-0 py-[17px] flex flex-col">
                {user.tier === 'FREE' && isGeneral && billingEnabled ? (
                  <>
                    <div className="text-center mb-[20px] text-xl [@media(max-width:1024px)]:text-xl">
                      <h1 className="text-3xl [@media(max-width:1024px)]:text-xl">
                        {t(
                          'join_10000_entrepreneurs_who_use_postnify',
                          'Join 10,000+ Entrepreneurs Who Use Postnify'
                        )}
                        <br />
                        {t(
                          'to_manage_all_your_social_media_channels',
                          'To Manage All Your Social Media Channels'
                        )}
                      </h1>
                      <br />
                      {user?.allowTrial && (
                        <div className="table mx-auto">
                          <div className="flex gap-[5px] items-center">
                            <div>
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="24"
                                height="24"
                                viewBox="0 0 24 24"
                                fill="none"
                              >
                                <path
                                  d="M16.2806 9.21937C16.3504 9.28903 16.4057 9.37175 16.4434 9.46279C16.4812 9.55384 16.5006 9.65144 16.5006 9.75C16.5006 9.84856 16.4812 9.94616 16.4434 10.0372C16.4057 10.1283 16.3504 10.211 16.2806 10.2806L11.0306 15.5306C10.961 15.6004 10.8783 15.6557 10.7872 15.6934C10.6962 15.7312 10.5986 15.7506 10.5 15.7506C10.4014 15.7506 10.3038 15.7312 10.2128 15.6934C10.1218 15.6557 10.039 15.6004 9.96938 15.5306L7.71938 13.2806C7.57865 13.1399 7.49959 12.949 7.49959 12.75C7.49959 12.551 7.57865 12.3601 7.71938 12.2194C7.86011 12.0786 8.05098 11.9996 8.25 11.9996C8.44903 11.9996 8.6399 12.0786 8.78063 12.2194L10.5 13.9397L15.2194 9.21937C15.289 9.14964 15.3718 9.09432 15.4628 9.05658C15.5538 9.01884 15.6514 8.99941 15.75 8.99941C15.8486 8.99941 15.9462 9.01884 16.0372 9.05658C16.1283 9.09432 16.211 9.14964 16.2806 9.21937ZM21.75 12C21.75 13.9284 21.1782 15.8134 20.1068 17.4168C19.0355 19.0202 17.5127 20.2699 15.7312 21.0078C13.9496 21.7458 11.9892 21.9389 10.0979 21.5627C8.20656 21.1865 6.46928 20.2579 5.10571 18.8943C3.74215 17.5307 2.81355 15.7934 2.43735 13.9021C2.06114 12.0108 2.25422 10.0504 2.99218 8.26884C3.73013 6.48726 4.97982 4.96451 6.58319 3.89317C8.18657 2.82183 10.0716 2.25 12 2.25C14.585 2.25273 17.0634 3.28084 18.8913 5.10872C20.7192 6.93661 21.7473 9.41498 21.75 12ZM20.25 12C20.25 10.3683 19.7661 8.77325 18.8596 7.41655C17.9531 6.05984 16.6646 5.00242 15.1571 4.37799C13.6497 3.75357 11.9909 3.59019 10.3905 3.90852C8.79017 4.22685 7.32016 5.01259 6.16637 6.16637C5.01259 7.32015 4.22685 8.79016 3.90853 10.3905C3.5902 11.9908 3.75358 13.6496 4.378 15.1571C5.00242 16.6646 6.05984 17.9531 7.41655 18.8596C8.77326 19.7661 10.3683 20.25 12 20.25C14.1873 20.2475 16.2843 19.3775 17.8309 17.8309C19.3775 16.2843 20.2475 14.1873 20.25 12Z"
                                  fill="#06ff00"
                                />
                              </svg>
                            </div>
                            <div>
                              {t('100_no_risk_trial', '100% no-risk trial')}
                            </div>
                          </div>
                          <div className="flex gap-[5px] items-center">
                            <div>
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="24"
                                height="24"
                                viewBox="0 0 24 24"
                                fill="none"
                              >
                                <path
                                  d="M16.2806 9.21937C16.3504 9.28903 16.4057 9.37175 16.4434 9.46279C16.4812 9.55384 16.5006 9.65144 16.5006 9.75C16.5006 9.84856 16.4812 9.94616 16.4434 10.0372C16.4057 10.1283 16.3504 10.211 16.2806 10.2806L11.0306 15.5306C10.961 15.6004 10.8783 15.6557 10.7872 15.6934C10.6962 15.7312 10.5986 15.7506 10.5 15.7506C10.4014 15.7506 10.3038 15.7312 10.2128 15.6934C10.1218 15.6557 10.039 15.6004 9.96938 15.5306L7.71938 13.2806C7.57865 13.1399 7.49959 12.949 7.49959 12.75C7.49959 12.551 7.57865 12.3601 7.71938 12.2194C7.86011 12.0786 8.05098 11.9996 8.25 11.9996C8.44903 11.9996 8.6399 12.0786 8.78063 12.2194L10.5 13.9397L15.2194 9.21937C15.289 9.14964 15.3718 9.09432 15.4628 9.05658C15.5538 9.01884 15.6514 8.99941 15.75 8.99941C15.8486 8.99941 15.9462 9.01884 16.0372 9.05658C16.1283 9.09432 16.211 9.14964 16.2806 9.21937ZM21.75 12C21.75 13.9284 21.1782 15.8134 20.1068 17.4168C19.0355 19.0202 17.5127 20.2699 15.7312 21.0078C13.9496 21.7458 11.9892 21.9389 10.0979 21.5627C8.20656 21.1865 6.46928 20.2579 5.10571 18.8943C3.74215 17.5307 2.81355 15.7934 2.43735 13.9021C2.06114 12.0108 2.25422 10.0504 2.99218 8.26884C3.73013 6.48726 4.97982 4.96451 6.58319 3.89317C8.18657 2.82183 10.0716 2.25 12 2.25C14.585 2.25273 17.0634 3.28084 18.8913 5.10872C20.7192 6.93661 21.7473 9.41498 21.75 12ZM20.25 12C20.25 10.3683 19.7661 8.77325 18.8596 7.41655C17.9531 6.05984 16.6646 5.00242 15.1571 4.37799C13.6497 3.75357 11.9909 3.59019 10.3905 3.90852C8.79017 4.22685 7.32016 5.01259 6.16637 6.16637C5.01259 7.32015 4.22685 8.79016 3.90853 10.3905C3.5902 11.9908 3.75358 13.6496 4.378 15.1571C5.00242 16.6646 6.05984 17.9531 7.41655 18.8596C8.77326 19.7661 10.3683 20.25 12 20.25C14.1873 20.2475 16.2843 19.3775 17.8309 17.8309C19.3775 16.2843 20.2475 14.1873 20.25 12Z"
                                  fill="#06ff00"
                                />
                              </svg>
                            </div>
                            <div>
                              {t(
                                'pay_nothing_for_the_first_7_days',
                                'Pay nothing for the first 7 days'
                              )}
                            </div>
                          </div>
                          <div className="flex gap-[5px] items-center">
                            <div>
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="24"
                                height="24"
                                viewBox="0 0 24 24"
                                fill="none"
                              >
                                <path
                                  d="M16.2806 9.21937C16.3504 9.28903 16.4057 9.37175 16.4434 9.46279C16.4812 9.55384 16.5006 9.65144 16.5006 9.75C16.5006 9.84856 16.4812 9.94616 16.4434 10.0372C16.4057 10.1283 16.3504 10.211 16.2806 10.2806L11.0306 15.5306C10.961 15.6004 10.8783 15.6557 10.7872 15.6934C10.6962 15.7312 10.5986 15.7506 10.5 15.7506C10.4014 15.7506 10.3038 15.7312 10.2128 15.6934C10.1218 15.6557 10.039 15.6004 9.96938 15.5306L7.71938 13.2806C7.57865 13.1399 7.49959 12.949 7.49959 12.75C7.49959 12.551 7.57865 12.3601 7.71938 12.2194C7.86011 12.0786 8.05098 11.9996 8.25 11.9996C8.44903 11.9996 8.6399 12.0786 8.78063 12.2194L10.5 13.9397L15.2194 9.21937C15.289 9.14964 15.3718 9.09432 15.4628 9.05658C15.5538 9.01884 15.6514 8.99941 15.75 8.99941C15.8486 8.99941 15.9462 9.01884 16.0372 9.05658C16.1283 9.09432 16.211 9.14964 16.2806 9.21937ZM21.75 12C21.75 13.9284 21.1782 15.8134 20.1068 17.4168C19.0355 19.0202 17.5127 20.2699 15.7312 21.0078C13.9496 21.7458 11.9892 21.9389 10.0979 21.5627C8.20656 21.1865 6.46928 20.2579 5.10571 18.8943C3.74215 17.5307 2.81355 15.7934 2.43735 13.9021C2.06114 12.0108 2.25422 10.0504 2.99218 8.26884C3.73013 6.48726 4.97982 4.96451 6.58319 3.89317C8.18657 2.82183 10.0716 2.25 12 2.25C14.585 2.25273 17.0634 3.28084 18.8913 5.10872C20.7192 6.93661 21.7473 9.41498 21.75 12ZM20.25 12C20.25 10.3683 19.7661 8.77325 18.8596 7.41655C17.9531 6.05984 16.6646 5.00242 15.1571 4.37799C13.6497 3.75357 11.9909 3.59019 10.3905 3.90852C8.79017 4.22685 7.32016 5.01259 6.16637 6.16637C5.01259 7.32015 4.22685 8.79016 3.90853 10.3905C3.5902 11.9908 3.75358 13.6496 4.378 15.1571C5.00242 16.6646 6.05984 17.9531 7.41655 18.8596C8.77326 19.7661 10.3683 20.25 12 20.25C14.1873 20.2475 16.2843 19.3775 17.8309 17.8309C19.3775 16.2843 20.2475 14.1873 20.25 12Z"
                                  fill="#06ff00"
                                />
                              </svg>
                            </div>
                            <div>
                              {t(
                                'cancel_anytime_hassle_free',
                                'Cancel anytime, hassle-free'
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    <BillingComponent />
                  </>
                ) : (
                  <>
                    <Title />
                    <div className="flex flex-1 flex-col">{children}</div>
                  </>
                )}
              </div>
            </div>
          </div>
        </MantineWrapper>
      </CopilotKit>
    </ContextWrapper>
  );
};

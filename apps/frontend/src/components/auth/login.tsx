'use client';

import { useForm, SubmitHandler, FormProvider } from 'react-hook-form';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import Link from 'next/link';
import { Button } from '@gitroom/react/form/button';
import { Input } from '@gitroom/react/form/input';
import { useMemo, useState, useEffect } from 'react';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { LoginUserDto } from '@gitroom/nestjs-libraries/dtos/auth/login.user.dto';
import { GithubProvider } from '@gitroom/frontend/components/auth/providers/github.provider';
import { OauthProvider } from '@gitroom/frontend/components/auth/providers/oauth.provider';
import { GoogleProvider } from '@gitroom/frontend/components/auth/providers/google.provider';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { FarcasterProvider } from '@gitroom/frontend/components/auth/providers/farcaster.provider';
import WalletProvider from '@gitroom/frontend/components/auth/providers/wallet.provider';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { useSearchParams } from 'next/navigation';
type Inputs = {
  email: string;
  password: string;
  providerToken: '';
  provider: 'LOCAL';
};
export function Login() {
  const t = useT();
  const [loading, setLoading] = useState(false);
  const { isGeneral, neynarClientId, billingEnabled } = useVariables();
  const searchParams = useSearchParams();

  // Force disable generic OAuth to show Google login
  const genericOauth = false;
  const resolver = useMemo(() => {
    return classValidatorResolver(LoginUserDto);
  }, []);
  const form = useForm<Inputs>({
    resolver,
    defaultValues: {
      providerToken: '',
      provider: 'LOCAL',
    },
  });
  const fetchData = useFetch();

  // Handle OAuth auth code from URL parameters
  useEffect(() => {
    const authCode = searchParams.get('authcode') || searchParams.get('token');
    const provider = searchParams.get('provider');
    const error = searchParams.get('error');

    if (error) {
      form.setError('email', { message: decodeURIComponent(error) });
    }

    if (authCode && provider) {
      // Complete OAuth registration/login
      handleOAuthAuthCode(authCode, provider);
    }
  }, [searchParams]);

  const handleOAuthAuthCode = async (authCode: string, provider: string) => {
    setLoading(true);
    try {
      console.log('Handling OAuth auth code:', { authCode: authCode.substring(0, 20) + '...', provider });

      // This can be either an access token or a regular OAuth code
      const response = await fetchData('/auth/oauth/' + provider + '/exists', {
        method: 'POST',
        body: JSON.stringify({ code: authCode }),
      });

      if (response.status === 200) {
        const data = await response.json();

        // If we get back a token, we need to register the user
        if (data.token) {
          const registerResponse = await fetchData('/auth/register', {
            method: 'POST',
            body: JSON.stringify({
              email: '', // OAuth providers will provide this
              password: '',
              provider: provider.toUpperCase(),
              providerToken: data.token,
              company: 'Default Company'
            })
          });

          if (registerResponse.status === 200) {
            console.log('OAuth registration completed successfully');
            window.location.href = '/';
          } else {
            const errorText = await registerResponse.text();
            console.error('OAuth registration failed:', errorText);
            form.setError('email', { message: 'Failed to create account from OAuth' });
          }
        } else {
          // Direct login success
          console.log('OAuth login completed successfully');
          window.location.href = '/';
        }
      } else {
        const errorText = await response.text();
        console.error('OAuth error response:', errorText);

        // If it's an invalid_grant error, the token might be invalid
        if (errorText.includes('invalid_grant') || errorText.includes('Malformed auth code')) {
          form.setError('email', { message: 'OAuth session expired. Please try again.' });
        } else {
          form.setError('email', { message: 'OAuth authentication failed. Please try again.' });
        }
      }
    } catch (error) {
      console.error('OAuth authentication failed:', error);
      form.setError('email', { message: 'OAuth authentication failed' });
    } finally {
      setLoading(false);
    }
  };
  const onSubmit: SubmitHandler<Inputs> = async (data) => {
    setLoading(true);
    const login = await fetchData('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        ...data,
        provider: 'LOCAL',
      }),
    });
    if (login.status === 400) {
      form.setError('email', {
        message: await login.text(),
      });
      setLoading(false);
    }
  };
  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div>
          <h1 className="text-xl sm:text-3xl font-bold text-start mb-4">
            {t('sign_in', 'Sign In')}
          </h1>
        </div>
        {isGeneral && genericOauth ? (
          <OauthProvider />
        ) : !isGeneral ? (
          <GithubProvider />
        ) : (
          <div className="gap-[5px] flex flex-col">
            <GoogleProvider />
            {!!neynarClientId && <FarcasterProvider />}
            {/* {billingEnabled && <WalletProvider />} */}
          </div>
        )}
        <div className="h-[20px] mb-[24px] mt-[24px] relative">
          <div className="absolute w-full h-[1px] bg-fifth top-[50%] -translate-y-[50%]" />
          <div
            className={`absolute z-[1] justify-center items-center w-full start-0 top-0 flex`}
          >
            <div className="bg-customColor15 px-[16px]">{t('or', 'OR')}</div>
          </div>
        </div>

        <div className="text-textColor">
          <Input
            label="Email"
            translationKey="label_email"
            {...form.register('email')}
            type="email"
            placeholder="Email Address"
          />
          <Input
            label="Password"
            translationKey="label_password"
            {...form.register('password')}
            autoComplete="off"
            type="password"
            placeholder="Password"
          />
        </div>
        <div className="text-center mt-6">
          <div className="w-full flex">
            <Button
              type="submit"
              className="flex-1 rounded-[4px] bg-primary"
              loading={loading}
            >
              {t('sign_in_1', 'Sign in')}
            </Button>
          </div>
          <p className="mt-4 text-sm">
            {t('don_t_have_an_account', "Don't Have An Account?")}&nbsp;
            <Link href="/auth" className="underline hover:no-underline hover:text-primary cursor-pointer">
              {t('sign_up', 'Sign Up')}
            </Link>
          </p>
          <p className="mt-4 text-sm text-red-600">
            <Link href="/auth/forgot" className="text-white underline hover:no-underline hover:text-primary cursor-pointer">
              {t('forgot_password', 'Forgot password')}
            </Link>
          </p>
        </div>
      </form>
    </FormProvider>
  );
}

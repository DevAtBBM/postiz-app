import { Injectable } from '@nestjs/common';
import { Provider, User } from '@prisma/client';
import { CreateOrgUserDto } from '@gitroom/nestjs-libraries/dtos/auth/create.org.user.dto';
import { LoginUserDto } from '@gitroom/nestjs-libraries/dtos/auth/login.user.dto';
import { UsersService } from '@gitroom/nestjs-libraries/database/prisma/users/users.service';
import { OrganizationService } from '@gitroom/nestjs-libraries/database/prisma/organizations/organization.service';
import { AuthService as AuthChecker } from '@gitroom/helpers/auth/auth.service';
import { ProvidersFactory } from '@gitroom/backend/services/auth/providers/providers.factory';
import dayjs from 'dayjs';
import { NotificationService } from '@gitroom/nestjs-libraries/database/prisma/notifications/notification.service';
import { ForgotReturnPasswordDto } from '@gitroom/nestjs-libraries/dtos/auth/forgot-return.password.dto';
import { EmailService } from '@gitroom/nestjs-libraries/services/email.service';
import { SubscriptionService } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/subscription.service';
import { NewsletterService } from '@gitroom/nestjs-libraries/newsletter/newsletter.service';

@Injectable()
export class AuthService {
  constructor(
    private _userService: UsersService,
    private _organizationService: OrganizationService,
    private _notificationService: NotificationService,
    private _emailService: EmailService,
    private _subscriptionService: SubscriptionService
  ) {}
  async canRegister(provider: string) {
    if (process.env.DISABLE_REGISTRATION !== 'true' || provider === Provider.GENERIC) {
      return true;
    }

    return (await this._organizationService.getCount()) === 0;
  }

  async routeAuth(
    provider: Provider,
    body: CreateOrgUserDto | LoginUserDto,
    ip: string,
    userAgent: string,
    addToOrg?: boolean | { orgId: string; role: 'USER' | 'ADMIN'; id: string }
  ) {
    if (provider === Provider.LOCAL) {
      if (process.env.DISALLOW_PLUS && body.email.includes('+')) {
        throw new Error('Email with plus sign is not allowed');
      }
      const user = await this._userService.getUserByEmail(body.email);
      if (body instanceof CreateOrgUserDto) {
        if (user) {
          if (user.activated) {
            throw new Error('Email already exists');
          } else {
            // User exists but not activated - allow resending verification email
            return await this.handleResendVerificationEmail(user, body, addToOrg);
          }
        }

        if (!(await this.canRegister(provider))) {
          throw new Error('Registration is disabled');
        }

        const create = await this._organizationService.createOrgAndUser(
          body,
          ip,
          userAgent
        );

        // Create a FREE subscription for the new organization
        try {
          await this._subscriptionService.createFreeSubscription(create.id);
        } catch (error) {
          console.error('Failed to create FREE subscription for new organization:', create.id, error);
          // Don't fail the user creation if subscription creation fails
        }

        const addedOrg =
          addToOrg && typeof addToOrg !== 'boolean'
            ? await this._organizationService.addUserToOrg(
                create.users[0].user.id,
                addToOrg.id,
                addToOrg.orgId,
                addToOrg.role
              )
            : false;

        const obj = { addedOrg, jwt: await this.jwt(create.users[0].user) };
        const activationHtml = `
          <p>Welcome to Postnify! 🎉</p>
          <p>Thank you for registering. To complete your account setup and start creating amazing content, please activate your account by clicking the button below.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL}/auth/activate/${obj.jwt}"
               style="background-color: #26b9c0; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
              Activate Your Account
            </a>
          </div>
          <p>This link will expire in 24 hours for security reasons.</p>
          <p>If you didn't create an account, you can safely ignore this email.</p>
        `;
        await this._emailService.sendEmail(
          body.email,
          'Welcome to Postnify - Activate Your Account',
          activationHtml
        );
        return obj;
      }

      if (!user || !AuthChecker.comparePassword(body.password, user.password)) {
        throw new Error('Invalid user name or password');
      }

      if (!user.activated) {
        throw new Error('User is not activated. Please check your email for verification link or register again.');
      }

      return { addedOrg: false, jwt: await this.jwt(user) };
    }

    const user = await this.loginOrRegisterProvider(
      provider,
      body as CreateOrgUserDto,
      ip,
      userAgent
    );

    const addedOrg =
      addToOrg && typeof addToOrg !== 'boolean'
        ? await this._organizationService.addUserToOrg(
            user.id,
            addToOrg.id,
            addToOrg.orgId,
            addToOrg.role
          )
        : false;
    return { addedOrg, jwt: await this.jwt(user) };
  }

  public getOrgFromCookie(cookie?: string) {
    if (!cookie) {
      return false;
    }

    try {
      const getOrg: any = AuthChecker.verifyJWT(cookie);
      if (dayjs(getOrg.timeLimit).isBefore(dayjs())) {
        return false;
      }

      return getOrg as {
        email: string;
        role: 'USER' | 'ADMIN';
        orgId: string;
        id: string;
      };
    } catch (err) {
      return false;
    }
  }

  private async loginOrRegisterProvider(
    provider: Provider,
    body: CreateOrgUserDto,
    ip: string,
    userAgent: string
  ) {
    const providerInstance = ProvidersFactory.loadProvider(provider);
    const providerUser = await providerInstance.getUser(body.providerToken);

    if (!providerUser) {
      throw new Error('Invalid provider token');
    }

    const user = await this._userService.getUserByProvider(
      providerUser.id,
      provider
    );
    if (user) {
      return user;
    }

    if (!(await this.canRegister(provider))) {
      throw new Error('Registration is disabled');
    }

    const create = await this._organizationService.createOrgAndUser(
      {
        company: body.company,
        email: providerUser.email,
        password: '',
        provider,
        providerId: providerUser.id,
      },
      ip,
      userAgent
    );

    // Create a FREE subscription for the new organization
    try {
      await this._subscriptionService.createFreeSubscription(create.id);
    } catch (error) {
      console.error('Failed to create FREE subscription for new organization:', create.id, error);
      // Don't fail the user creation if subscription creation fails
    }

    await NewsletterService.register(providerUser.email);

    return create.users[0].user;
  }

  async forgot(email: string) {
    const user = await this._userService.getUserByEmail(email);
    if (!user || user.providerName !== Provider.LOCAL) {
      return false;
    }

    const resetValues = AuthChecker.signJWT({
      id: user.id,
      expires: dayjs().add(20, 'minutes').format('YYYY-MM-DD HH:mm:ss'),
    });

    const resetHtml = `
      <p>Hello,</p>
      <p>We received a request to reset your password for your Postnify account. If you made this request, click the button below to reset your password.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.FRONTEND_URL}/auth/forgot/${resetValues}"
           style="background-color: #26b9c0; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
          Reset Your Password
        </a>
      </div>
      <p><strong>Important:</strong> This link will expire in 20 minutes for security reasons.</p>
      <p>If you didn't request a password reset, please ignore this email. Your password will remain unchanged.</p>
      <p>For your security, never share this email or the reset link with anyone.</p>
    `;
    await this._notificationService.sendEmail(
      user.email,
      'Reset Your Postnify Password',
      resetHtml
    );
  }

  forgotReturn(body: ForgotReturnPasswordDto) {
    const user = AuthChecker.verifyJWT(body.token) as {
      id: string;
      expires: string;
    };
    if (dayjs(user.expires).isBefore(dayjs())) {
      return false;
    }

    return this._userService.updatePassword(user.id, body.password);
  }

  async activate(code: string) {
    const user = AuthChecker.verifyJWT(code) as {
      id: string;
      activated: boolean;
      email: string;
    };
    if (user.id && !user.activated) {
      const getUserAgain = await this._userService.getUserByEmail(user.email);
      if (getUserAgain.activated) {
        return false;
      }
      await this._userService.activateUser(user.id);
      user.activated = true;
      await NewsletterService.register(user.email);
      return this.jwt(user as any);
    }

    return false;
  }

  oauthLink(provider: string, query?: any) {
    const providerInstance = ProvidersFactory.loadProvider(
      provider as Provider
    );
    return providerInstance.generateLink(query);
  }

  async checkExists(provider: string, code: string) {
    const providerInstance = ProvidersFactory.loadProvider(
      provider as Provider
    );
    const token = await providerInstance.getToken(code);
    const user = await providerInstance.getUser(token);
    if (!user) {
      throw new Error('Invalid user');
    }
    const checkExists = await this._userService.getUserByProvider(
      user.id,
      provider as Provider
    );
    if (checkExists) {
      return { jwt: await this.jwt(checkExists) };
    }

    return { token };
  }

  private async handleResendVerificationEmail(
    user: any,
    body: CreateOrgUserDto,
    addToOrg?: boolean | { orgId: string; role: 'USER' | 'ADMIN'; id: string }
  ) {
    const userWithVerification = await this._userService.getUserWithVerificationData(body.email);

    if (!userWithVerification) {
      throw new Error('User not found');
    }

    // Check if we should reset attempts (if it's a new day)
    const lastReset = userWithVerification.emailVerificationResetAt;
    const now = dayjs();
    const isNewDay = !lastReset || now.diff(dayjs(lastReset), 'day') >= 1;

    if (isNewDay) {
      await this._userService.resetEmailVerificationAttempts(user.id);
      userWithVerification.emailVerificationAttempts = 0;
    }

    // Check if user has exceeded the daily limit (2 attempts per day)
    if (userWithVerification.emailVerificationAttempts >= 2) {
      throw new Error('Email verification limit exceeded. Please try again tomorrow.');
    }

    // Increment attempts and send new verification email
    await this._userService.incrementEmailVerificationAttempts(user.id);

    const addedOrg =
      addToOrg && typeof addToOrg !== 'boolean'
        ? await this._organizationService.addUserToOrg(
            user.id,
            addToOrg.id,
            addToOrg.orgId,
            addToOrg.role
          )
        : false;

    const obj = { addedOrg, jwt: await this.jwt(user) };
    const activationHtml = `
      <p>Welcome back to Postnify! 🎉</p>
      <p>You've been added to a new organization. To access it, please activate your account by clicking the button below.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.FRONTEND_URL}/auth/activate/${obj.jwt}"
           style="background-color: #26b9c0; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
          Activate Your Account
        </a>
      </div>
      <p>This link will expire in 24 hours for security reasons.</p>
      <p>If you didn't request this, you can safely ignore this email.</p>
    `;
    await this._emailService.sendEmail(
      body.email,
      'Welcome to Postnify - Activate Your Account',
      activationHtml
    );
    return obj;
  }

  private async jwt(user: User) {
    return AuthChecker.signJWT(user);
  }
}

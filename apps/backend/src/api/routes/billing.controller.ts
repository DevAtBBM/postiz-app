import { Body, Controller, Get, HttpException, Param, Post, Query, Req } from '@nestjs/common';
import * as crypto from 'crypto';
import { SubscriptionService } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/subscription.service';
import { PayPalService } from '@gitroom/nestjs-libraries/services/paypal.service';
import { RazorpayService } from '@gitroom/nestjs-libraries/services/razorpay.service';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { Organization, User } from '@prisma/client';
import { BillingSubscribeDto } from '@gitroom/nestjs-libraries/dtos/billing/billing.subscribe.dto';
import { ApiTags } from '@nestjs/swagger';
import { GetUserFromRequest } from '@gitroom/nestjs-libraries/user/user.from.request';
import { NotificationService } from '@gitroom/nestjs-libraries/database/prisma/notifications/notification.service';
import { Request } from 'express';
import { Nowpayments } from '@gitroom/nestjs-libraries/crypto/nowpayments';

@ApiTags('Billing')
@Controller('/billing')
export class BillingController {
  constructor(
    private _subscriptionService: SubscriptionService,
    private _paypalService: PayPalService,
    private _razorpayService: RazorpayService,
    private _notificationService: NotificationService,
    private _nowpayments: Nowpayments
  ) {}

  @Get('/check/:id')
  async checkId(
    @GetOrgFromRequest() org: Organization,
    @Param('id') body: string
  ) {
    return {
      status: await this._subscriptionService.checkSubscription(org.id, body),
    };
  }

  @Get('/check-discount')
  async checkDiscount() {
    return { offerCoupon: false };
  }

  @Post('/finish-trial')
  async finishTrial(@GetOrgFromRequest() org: Organization) {
    return { finish: true };
  }

  @Get('/is-trial-finished')
  async isTrialFinished(@GetOrgFromRequest() org: Organization) {
    return { finished: !org.isTrailing };
  }

  @Post('/subscribe')
  async subscribe(
    @GetOrgFromRequest() org: Organization,
    @GetUserFromRequest() user: User,
    @Body() body: BillingSubscribeDto & { provider?: 'paypal' | 'razorpay' },
    @Req() req: Request
  ): Promise<any> {
    const uniqueId = req?.cookies?.track || `${org.id}_${Date.now()}`;
    const provider = body.provider || 'paypal';

    let subscriptionResult: any;

    if (provider === 'razorpay') {
      subscriptionResult = await this._razorpayService.subscribe(
        uniqueId,
        org.id,
        user.id,
        body,
        org.allowTrial
      );
    } else {
      subscriptionResult = await this._paypalService.subscribe(
        uniqueId,
        org.id,
        user.id,
        body,
        org.allowTrial
      );
    }

    // Only store the subscription ID on the org so the webhook can find it.
    // Do NOT update the subscription tier here — tier is updated only after payment is confirmed
    // via the subscription.activated / BILLING.SUBSCRIPTION.ACTIVATED webhook.
    try {
      await this._subscriptionService.updateCustomerId(org.id, subscriptionResult.id);
    } catch (err) {
      console.error(`Failed to store ${provider} subscription ID on org ${org.id}:`, err);
    }

    // Extract PayPal approval URL
    const approvalLink = subscriptionResult.links?.find((l: any) => l.rel === 'approve');
    const url = approvalLink ? approvalLink.href : null;

    return {
      url,
      subscriptionId: subscriptionResult.id,
      provider,
      ...subscriptionResult,
    };
  }

  @Get('/portal')
  async modifyPayment(@GetOrgFromRequest() org: Organization) {
    return {
      portal: `https://www.paypal.com/myaccount/billing/subscriptions`,
    };
  }

  @Get('/')
  getCurrentBilling(@GetOrgFromRequest() org: Organization) {
    return this._subscriptionService.getSubscriptionByOrganizationId(org.id);
  }

  @Post('/cancel')
  async cancel(
    @GetOrgFromRequest() org: Organization,
    @GetUserFromRequest() user: User,
    @Body() body: { feedback: string }
  ) {
    const currentSubscription =
      await this._subscriptionService.getSubscriptionByOrganizationId(org.id);

    await this._notificationService.sendEmail(
      process.env.EMAIL_FROM_ADDRESS,
      'Subscription Cancelled',
      `Organization ${org.name} has cancelled their subscription because: ${body.feedback}`,
      user.email?.includes('@') ? user.email : undefined
    );

    if (currentSubscription?.cancelAt) {
      // Reactivate: clear cancelAt
      await this._subscriptionService.updateSubscriptionCancelAt(org.id, null);
      return { cancel_at: null };
    }

    // Schedule cancellation at end of period (30 days from now)
    const cancelAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await this._subscriptionService.updateSubscriptionCancelAt(org.id, cancelAt);
    return { cancel_at: cancelAt };
  }

  @Post('/prorate')
  async prorate(
    @GetOrgFromRequest() org: Organization,
    @Body() body: BillingSubscribeDto
  ) {
    // PayPal doesn't have native proration — return 0 so UI can proceed
    return { price: 0 };
  }

  @Post('/lifetime')
  async lifetime(
    @GetOrgFromRequest() org: Organization,
    @Body() body: { code: string }
  ) {
    return { success: false, message: 'Lifetime deals are not currently available' };
  }

  @Post('/add-subscription')
  async addSubscription(
    @Body() body: { subscription: string },
    @GetUserFromRequest() user: User,
    @GetOrgFromRequest() org: Organization
  ) {
    if (!user.isSuperAdmin) {
      throw new Error('Unauthorized');
    }

    await this._subscriptionService.addSubscription(
      org.id,
      user.id,
      body.subscription
    );
  }

  @Get('/transactions')
  async getTransactions(@GetOrgFromRequest() org: Organization) {
    return this._subscriptionService.getTransactionHistory(org.id);
  }

  @Get('/failed-payments')
  async getFailedPayments(@GetOrgFromRequest() org: Organization) {
    return this._subscriptionService.getFailedPayments(org.id);
  }

  @Get('/crypto')
  async crypto(@GetOrgFromRequest() org: Organization) {
    return this._nowpayments.createPaymentPage(org.id);
  }

  @Post('/report-billing-issue')
  async reportBillingIssue(
    @GetOrgFromRequest() org: Organization,
    @GetUserFromRequest() user: User,
    @Body() body: {
      issueType: 'PAYMENT_FAILED' | 'SERVICE_PROBLEM' | 'ACCOUNT_QUESTION' | 'OTHER';
      description: string;
      severity: 'LOW' | 'MEDIUM' | 'HIGH';
    }
  ) {
    try {
      const subject = `Billing Issue Report - ${org.name}`;
      const emailBody = `Billing Issue Report\n\nOrganization: ${org.name}\nOrganization ID: ${org.id}\nUser: ${user.email || user.id} (${user.email || 'wallet login'})\n\nIssue Type: ${body.issueType}\nSeverity: ${body.severity}\nDescription: ${body.description}\n\nReported at: ${new Date().toISOString()}`;

      await this._notificationService.sendEmail(
        process.env.EMAIL_FROM_ADDRESS,
        subject,
        emailBody,
        process.env.SUPPORT_EMAIL_ADDRESS || process.env.EMAIL_FROM_ADDRESS
      );

      const userEmail = user.email?.includes('@') ? user.email : null;
      if (userEmail) {
        await this._notificationService.sendEmail(
          process.env.EMAIL_FROM_ADDRESS,
          'Billing Issue Received - Ref #' + Math.random().toString(36).substr(2, 6).toUpperCase(),
          `Dear ${userEmail},\n\nThank you for reporting a billing issue. Our support team will respond within 24 hours.\n\nIssue Type: ${body.issueType}\nSeverity: ${body.severity}`,
          userEmail
        );
      }

      return { success: true, message: 'Billing issue reported successfully. You will receive a response within 24 hours.' };
    } catch (error) {
      console.error('Error reporting billing issue:', error);
      throw new Error('Failed to report billing issue');
    }
  }

  // ── Razorpay-specific endpoints ──────────────────────────────────────────

  @Post('/verify-payment')
  async verifyRazorpayPayment(
    @Body() body: {
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
      organizationId: string;
      planName: string;
      period: string;
      amount: number;
    }
  ) {
    const sign = body.razorpay_order_id + '|' + body.razorpay_payment_id;
    const expectedSign = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(sign.toString())
      .digest('hex');

    if (body.razorpay_signature !== expectedSign) {
      throw new HttpException('Payment signature verification failed', 400);
    }

    const channelCount =
      body.planName === 'STANDARD' ? 5 :
      body.planName === 'PRO' ? 20 :
      body.planName === 'ULTIMATE' ? 100 : 1;

    const subscriptionResult = await this._subscriptionService.createPayPalSubscription(
      false,
      body.razorpay_payment_id,
      body.razorpay_payment_id,
      body.planName as any,
      body.period as 'MONTHLY' | 'YEARLY',
      null,
      { id: body.organizationId }
    );

    try {
      await this._subscriptionService.createPaymentTransaction(
        body.organizationId,
        null,
        'RAZORPAY',
        body.razorpay_payment_id,
        body.amount * 100,
        'INR',
        'SUCCEEDED',
        'SUBSCRIPTION_PAYMENT',
        undefined,
        `Razorpay subscription payment - ${body.planName}`,
        undefined,
        { razorpay_order_id: body.razorpay_order_id, razorpay_signature: body.razorpay_signature }
      );
    } catch (err) {
      console.error('Failed to save Razorpay transaction record:', err);
    }

    return {
      success: true,
      message: 'Payment verified and subscription activated',
      subscription: subscriptionResult,
    };
  }

  @Get('/razorpay-redirect')
  async handleRazorpayRedirect(
    @Query() query: {
      subscription_id?: string;
      org_id?: string;
    }
  ) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    if (query.subscription_id) {
      const status = await this._razorpayService.checkSubscription(
        query.org_id || '',
        query.subscription_id
      );

      if (status === 'ACTIVE') {
        return {
          redirectUrl: `${frontendUrl}/billing/success?provider=razorpay&subscription_id=${query.subscription_id}&org_id=${query.org_id}`,
        };
      }

      return {
        redirectUrl: `${frontendUrl}/billing/cancel?provider=razorpay&subscription_id=${query.subscription_id}&org_id=${query.org_id}`,
      };
    }

    return { redirectUrl: `${frontendUrl}/billing` };
  }
}

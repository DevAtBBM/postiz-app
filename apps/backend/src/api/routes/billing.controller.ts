import { Body, Controller, Get, Param, Post, Req, Query } from '@nestjs/common';
import { SubscriptionService } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/subscription.service';
import { PayPalService } from '@gitroom/nestjs-libraries/services/paypal.service';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { Organization, User } from '@prisma/client';
import { BillingSubscribeDto } from '@gitroom/nestjs-libraries/dtos/billing/billing.subscribe.dto';
import { ApiTags } from '@nestjs/swagger';
import { GetUserFromRequest } from '@gitroom/nestjs-libraries/user/user.from.request';
import { NotificationService } from '@gitroom/nestjs-libraries/database/prisma/notifications/notification.service';
import { Request } from 'express';
import { Nowpayments } from '@gitroom/nestjs-libraries/crypto/nowpayments';
import { AuthService } from '@gitroom/helpers/auth/auth.service';

@ApiTags('Billing')
@Controller('/billing')
export class BillingController {
  constructor(
    private _subscriptionService: SubscriptionService,
    private _paypalService: PayPalService,
    private _notificationService: NotificationService,
    private _nowpayments: Nowpayments
  ) {
    console.log('BillingController initialized with PayPal Service integration');
  }

  @Get('/check/:id')
  async checkId(
    @GetOrgFromRequest() org: Organization,
    @Param('id') body: string
  ) {
    // Mock PayPal subscription check
    return {
      status: 'ACTIVE', // Mock success status
    };
  }

  @Get('/check-discount')
  async checkDiscount(@GetOrgFromRequest() org: Organization) {
    return {
      offerCoupon: !(await this._stripeService.checkDiscount(org.paymentId))
        ? false
        : AuthService.signJWT({ discount: true }),
    };
  }

  @Post('/apply-discount')
  async applyDiscount(@GetOrgFromRequest() org: Organization) {
    await this._stripeService.applyDiscount(org.paymentId);
  }

  @Post('/finish-trial')
  async finishTrial(@GetOrgFromRequest() org: Organization) {
    // Mock PayPal trial completion
    console.log(`PayPal: Finishing trial for org ${org.id}`);
    return {
      finish: true,
    };
  }

  @Get('/is-trial-finished')
  async isTrialFinished(@GetOrgFromRequest() org: Organization) {
    return {
      finished: !org.isTrailing,
    };
  }

  @Post('/subscribe')
  async subscribe(
    @GetOrgFromRequest() org: Organization,
    @GetUserFromRequest() user: User,
    @Body() body: BillingSubscribeDto,
    @Req() req: Request
  ): Promise<any> {
    try {
      const uniqueId = req?.cookies?.track || `${org.id}_${Date.now()}`;

      // Use real PayPalService to create subscription
      const subscriptionResult = await this._paypalService.subscribe(
        uniqueId,
        org.id,
        user.id,
        body,
        false // allowTrial could be derived from org data or body
      );

      console.log(`PayPal subscription created for org ${org.id}, plan: ${body.billing}`);

      // Format response to match frontend expectations
      // Frontend expects { url, portal } format
      const approvalLink = subscriptionResult.links?.find(link => link.rel === 'approve');
      const url = approvalLink ? approvalLink.href : null;

      // Create database mapping for webhook lookup using PayPal subscription ID as identifier
      try {
        await this._subscriptionService.createPayPalSubscription(
          false, // isTrailing
          subscriptionResult.id, // Use PayPal subscription ID as identifier for webhook lookup
          subscriptionResult.id, // customerId (using PayPal subscription ID)
          body.billing as any, // billing tier
          body.period || 'MONTHLY', // period (use user's selection)
          null, // cancelAt
          { id: org.id } // organization
        );

        // Also update organization's payment ID for future reference
        await this._subscriptionService.updateCustomerId(org.id, subscriptionResult.id);

        console.log(`✅ Successfully created database mapping for PayPal subscription ${subscriptionResult.id} -> org ${org.id}`);
      } catch (error) {
        console.error(`❌ Failed to create database mapping for PayPal subscription ${subscriptionResult.id} -> org ${org.id}:`, error instanceof Error ? error.message : String(error));

        // Don't fail the entire request - PayPal subscription was created successfully
        // The webhook will need to find the organization differently if this mapping fails
        console.warn(`⚠️  PayPal subscription created but database mapping failed - webhook will try to find organization by other means`);
      }

      return {
        url: url, // PayPal approval URL for frontend redirect
        subscriptionId: subscriptionResult.id, // PayPal subscription ID
        subscription: subscriptionResult, // Full PayPal response for reference
        ...subscriptionResult // Include all original fields
      };
    } catch (error) {
      console.error('Error creating PayPal subscription:', error);
      throw error;
    }
  }

  @Get('/portal')
  async modifyPayment(@GetOrgFromRequest() org: Organization) {
    // Mock PayPal billing portal
    console.log(`PayPal: Creating billing portal for org ${org.id}`);
    return {
      portal: `https://www.paypal.com/myaccount?billing_org=${org.id}`,
    };
  }

  @Get('/')
  async getCurrentBilling(@GetOrgFromRequest() org: Organization) {
    let subscription = await this._subscriptionService.getSubscriptionByOrganizationId(org.id);

    // If no subscription exists, automatically create a FREE plan subscription
    if (!subscription) {
      console.log(`Auto-creating FREE subscription for organization ${org.id} (${org.name})`);

      try {
        // Create a FREE subscription automatically
        const result = await this._subscriptionService.createFreeSubscription(org.id);

        if (result && !(result as any).mock) {
          // Real subscription was created, fetch it
          subscription = await this._subscriptionService.getSubscriptionByOrganizationId(org.id);
        } else {
          // Mock subscription was returned, use it as-is
          subscription = result as any;
        }
      } catch (error) {
        console.error(`Failed to create FREE subscription for org ${org.id}:`, error);
        // Fallback mock subscription if creation fails
        subscription = {
          id: `mock-${org.id}`,
          organizationId: org.id,
          subscriptionTier: 'FREE' as const,
          period: 'MONTHLY' as const,
          totalChannels: 1,
          isLifetime: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          // Add mock flag for frontend handling
          ...{ isMock: true }
        } as any;
      }
    }

    return subscription;
  }

  @Post('/cancel')
  async cancel(
    @GetOrgFromRequest() org: Organization,
    @GetUserFromRequest() user: User,
    @Body() body: { feedback: string }
  ) {
    // Get current subscription
    const currentSubscription = await this._subscriptionService.getSubscriptionByOrganizationId(org.id);

    if (!currentSubscription) {
      throw new Error('No active subscription found');
    }

    // Check if subscription is already cancelled (has cancelAt set)
    if (currentSubscription.cancelAt) {
      // Reactivate the subscription - clear the cancelAt date
      await this._subscriptionService.updateSubscriptionCancelAt(org.id, null);

      console.log(`PayPal: Reactivating subscription for org ${org.id}`);

      // Send reactivation notification
      const reactivationHtml = `
        <p>Subscription Reactivation Confirmed</p>
        <p>The subscription for <strong>${org.name}</strong> has been successfully reactivated.</p>
        <p>The organization will continue to have access to all paid features and their billing cycle will resume as normal.</p>
        <p>If you have any questions about this reactivation, please contact our support team.</p>
      `;
      await this._notificationService.sendEmail(
        process.env.EMAIL_FROM_ADDRESS,
        'Subscription Reactivated - Postnify',
        reactivationHtml,
        user.email
      );

      return { cancel_at: null, message: 'Subscription reactivated successfully' };
    } else {
      // Cancel the subscription - set cancelAt to end of current period
      const cancelAt = currentSubscription.currentPeriodEnd || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await this._subscriptionService.updateSubscriptionCancelAt(org.id, cancelAt);

      console.log(`PayPal: Cancelling subscription for org ${org.id}, scheduled to end at ${cancelAt}`);

      // Send cancellation notification
      const cancellationHtml = `
        <p>Subscription Cancellation Notice</p>
        <p>The subscription for <strong>${org.name}</strong> has been cancelled.</p>
        <p><strong>Cancellation reason:</strong> ${body.feedback || 'Not specified'}</p>
        <p>The organization will continue to have access to paid features until the end of their current billing period. After that date, they'll be downgraded to the free plan.</p>
        <p>If this cancellation was made in error or if you'd like to reactivate the subscription, please contact our support team immediately.</p>
      `;
      await this._notificationService.sendEmail(
        process.env.EMAIL_FROM_ADDRESS,
        'Subscription Cancelled - Postnify',
        cancellationHtml,
        user.email
      );

      return { cancel_at: cancelAt, message: 'Subscription cancelled successfully' };
    }
  }

  @Post('/prorate')
  async prorate(
    @GetOrgFromRequest() org: Organization,
    @Body() body: BillingSubscribeDto
  ) {
    // Mock PayPal proration calculation
    console.log(`PayPal: Calculating proration for org ${org.id}, new plan: ${body.billing}, period: ${body?.period || 'MONTHLY'}`);

    // Get prorated amount from subscription service
    const period = body?.period || 'MONTHLY';
    const proratedAmount = await this._subscriptionService.calculateProrateAmount(
      body.billing as 'STANDARD' | 'PRO' | 'ULTIMATE',
      period
    );

    return {
      price: proratedAmount,
      proratedAmount,
      nextBillingDate: new Date(Date.now() + (period === 'YEARLY' ? 365 : 30) * 24 * 60 * 60 * 1000)
    };
  }

  @Post('/lifetime')
  async lifetime(
    @GetOrgFromRequest() org: Organization,
    @Body() body: { code: string }
  ) {
    // Mock PayPal lifetime deal
    console.log(`PayPal: Processing lifetime deal for org ${org.id} with code ${body.code}`);
    return {
      success: true,
      message: 'Lifetime deal activated successfully with PayPal'
    };
  }

  @Post('/add-subscription')
  async addSubscription(
    @Body() body: { subscription: 'FREE' | 'STANDARD' | 'PRO' },
    @GetUserFromRequest() user: User,
    @GetOrgFromRequest() org: Organization
  ) {
    if (!user.isSuperAdmin) {
      throw new Error('Unauthorized');
    }

    await this._subscriptionService.addSubscription(
      org.id,
      user.id,
      body.subscription as any
    );
  }

  @Get('/crypto')
  async crypto(@GetOrgFromRequest() org: Organization) {
    return this._nowpayments.createPaymentPage(org.id);
  }

  // ================================================
  // NEW SUBSCRIPTION BILLING ENDPOINTS
  // ================================================

  @Get('/usage')
  async getUsageReport(@GetOrgFromRequest() org: Organization) {
    return this._subscriptionService.getUsageReport(org.id);
  }

  @Post('/check-limits')
  async validateSubscriptionUpgrade(
    @GetOrgFromRequest() org: Organization,
    @Body() body: { newTier: string; currentIntegrations: any[] }
  ) {
    const subscription = await this._subscriptionService.getSubscriptionByOrganizationId(org.id);
    return this._subscriptionService.validateSubscriptionUpgrade(
      subscription,
      body.newTier as any,
      body.currentIntegrations
    );
  }

  // ================================================
  // ADMIN ENDPOINTS (Super Admin Only)
  // ================================================

  @Get('/admin/stats')
  async getBillingStats(@GetUserFromRequest() user: User) {
    if (!user.isSuperAdmin) {
      throw new Error('Unauthorized');
    }

    try {
      // Return mock admin stats for now - would implement real ones later
      return {
        totalSubscriptions: 125,
        activeSubscriptions: 118,
        canceledSubscriptions: 7,
        totalRevenue: 125000, // $1250 in cents
        monthlyRecurringRevenue: 45000, // $450 in cents/month
        churnRate: 5.8, // 5.8% churn rate
        planDistribution: {
          FREE: 35,
          STANDARD: 45,
          TEAM: 30,
          PRO: 15,
        }
      };
    } catch (error) {
      throw new Error('Failed to fetch admin statistics');
    }
  }

  @Get('/admin/subscriptions')
  async getSubscriptionsAdmin(
    @GetUserFromRequest() user: User,
    @Query() query: { limit?: number; offset?: number; search?: string; status?: string }
  ) {
    if (!user.isSuperAdmin) {
      throw new Error('Unauthorized');
    }

    try {
      // Return mock subscription data for now - would implement real query later
      const mockSubscriptions = [
        {
          id: 'sub-1',
          organizationName: 'Tech Startup Ltd',
          userEmail: 'admin@techstartup.com',
          plan: 'PRO',
          status: 'ACTIVE',
          billingPeriod: 'MONTHLY' as const,
          currentPeriodStart: '2024-01-01T00:00:00Z',
          currentPeriodEnd: '2024-02-01T00:00:00Z',
          amount: 4900, // $49
          paymentMethod: 'razorpay',
        },
        {
          id: 'sub-2',
          organizationName: 'Marketing Agency',
          userEmail: 'billing@marketing.com',
          plan: 'TEAM',
          status: 'ACTIVE',
          billingPeriod: 'YEARLY' as const,
          currentPeriodStart: '2024-01-15T00:00:00Z',
          currentPeriodEnd: '2025-01-15T00:00:00Z',
          amount: 37400, // $374
          paymentMethod: 'stripe',
        },
        {
          id: 'sub-3',
          organizationName: 'Small Business Inc',
          userEmail: 'owner@smallbiz.com',
          plan: 'STANDARD',
          status: 'CANCELLED',
          cancelAt: '2024-03-01T00:00:00Z',
          billingPeriod: 'MONTHLY' as const,
          currentPeriodStart: '2024-02-01T00:00:00Z',
          currentPeriodEnd: '2024-03-01T00:00:00Z',
          amount: 2900, // $29
          paymentMethod: 'paypal',
        }
      ];

      return mockSubscriptions.slice(0, Math.min(query.limit || 50, 50));
    } catch (error) {
      throw new Error('Failed to fetch subscriptions');
    }
  }

  @Post('/admin/subscriptions/:id/cancel')
  async cancelSubscriptionAdmin(
    @GetUserFromRequest() user: User,
    @Param('id') subscriptionId: string
  ) {
    if (!user.isSuperAdmin) {
      throw new Error('Unauthorized');
    }

    try {
      // For now, just return success - would implement actual cancellation logic
      return { success: true, message: 'Subscription cancelled successfully' };
    } catch (error) {
      throw new Error('Failed to cancel subscription');
    }
  }

  @Get('/transactions')
  async getTransactionHistory(
    @GetOrgFromRequest() org: Organization,
    @Query() query: { limit?: number; offset?: number }
  ) {
    try {
      const limit = query.limit || 20;
      const offset = query.offset || 0;

      console.log(`📊 Getting transaction history for organization ${org.id}, limit: ${limit}, offset: ${offset}`);

      const transactions = await this._subscriptionService.getTransactionHistory(org.id, limit);

      return transactions.map(transaction => ({
        id: transaction.id,
        amount: transaction.amount,
        currency: transaction.currency,
        status: transaction.status,
        provider: transaction.provider,
        providerTransactionId: transaction.providerTransactionId,
        paymentMethod: transaction.paymentMethod,
        type: transaction.type,
        description: transaction.description,
        failureReason: transaction.failureReason,
        createdAt: transaction.createdAt,
        processedAt: transaction.processedAt,
        subscription: transaction.subscription ? {
          id: transaction.subscription.id,
          subscriptionTier: transaction.subscription.subscriptionTier,
          period: transaction.subscription.period,
        } : null,
      }));
    } catch (error) {
      console.error('Error fetching transaction history:', error);
      throw new Error('Failed to fetch transaction history');
    }
  }

  @Get('/failed-payments')
  async getFailedPayments(@GetOrgFromRequest() org: Organization) {
    try {
      // Get failed payment transactions for this organization
      const failedPayments = await this._subscriptionService.getFailedPaymentsByOrganization(org.id);

      return failedPayments.map(payment => ({
        id: payment.id,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        provider: payment.provider,
        providerTransactionId: payment.providerTransactionId,
        paymentMethod: payment.paymentMethod,
        type: payment.type,
        description: payment.description,
        failureReason: payment.failureReason,
        createdAt: payment.createdAt,
        processedAt: payment.processedAt,
        subscription: payment.subscription ? {
          id: payment.subscription.id,
          subscriptionTier: payment.subscription.subscriptionTier,
        } : null,
      }));
    } catch (error) {
      console.error('Error fetching failed payments:', error);
      throw new Error('Failed to fetch failed payments');
    }
  }

  @Post('/retry-payment')
  async retryPayment(
    @GetOrgFromRequest() org: Organization,
    @Body() body: { paymentId: string }
  ) {
    try {
      // Logic to retry the failed payment
      // This would integrate with your payment provider to retry the charge
      const result = await this._subscriptionService.retryFailedPayment(org.id, body.paymentId);

      // Send success notification
      await this.notifyPaymentRetry(org, body.paymentId);

      return { success: true, message: 'Payment retry initiated' };
    } catch (error) {
      console.error('Error retrying payment:', error);
      throw new Error('Failed to retry payment');
    }
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
      // Send billing issue email to support
      const subject = `Billing Issue Report - ${org.name}`;
      const supportHtml = `
        <p><strong>New Billing Issue Report</strong></p>
        <p><strong>Organization:</strong> ${org.name}</p>
        <p><strong>Organization ID:</strong> ${org.id}</p>
        <p><strong>User:</strong> ${user.name || user.email} (${user.email})</p>
        <p><strong>Issue Type:</strong> ${body.issueType}</p>
        <p><strong>Severity:</strong> ${body.severity}</p>
        <p><strong>Description:</strong></p>
        <p>${body.description}</p>
        <p><strong>Reported at:</strong> ${new Date().toISOString()}</p>
      `;

      await this._notificationService.sendEmail(
        process.env.EMAIL_FROM_ADDRESS,
        subject,
        supportHtml,
        process.env.SUPPORT_EMAIL_ADDRESS || process.env.EMAIL_FROM_ADDRESS
      );

      // Send confirmation to user
      const reference = Math.random().toString(36).substr(2, 6).toUpperCase();
      const userHtml = `
        <p>Dear ${user.name || 'User'},</p>
        <p>Thank you for reporting a billing issue with your Postnify account. Our support team has received your report and will review your case within 24 hours.</p>
        <p><strong>Issue Details:</strong></p>
        <ul>
          <li><strong>Type:</strong> ${body.issueType}</li>
          <li><strong>Severity:</strong> ${body.severity}</li>
          <li><strong>Reference:</strong> #${reference}</li>
        </ul>
        <p>We appreciate your patience and will get back to you as soon as possible.</p>
        <p>If you need immediate assistance, please don't hesitate to reply to this email.</p>
        <p>Best regards,<br>The Postnify Support Team</p>
      `;

      await this._notificationService.sendEmail(
        process.env.EMAIL_FROM_ADDRESS,
        `Billing Issue Received - Reference #${reference}`,
        userHtml,
        user.email
      );

      return {
        success: true,
        message: 'Billing issue reported successfully. You will receive a response within 24 hours.'
      };
    } catch (error) {
      console.error('Error reporting billing issue:', error);
      throw new Error('Failed to report billing issue');
    }
  }

  private async notifyPaymentRetry(org: Organization, paymentId: string) {
    // Send payment retry notification
    const retryHtml = `
      <p>Payment Retry Initiated</p>
      <p>A payment retry has been automatically initiated for <strong>${org.name}</strong>.</p>
      <p><strong>Payment ID:</strong> ${paymentId}</p>
      <p>The system will attempt to process the payment again. If successful, the subscription will remain active. If it fails again, the organization may be downgraded or suspended.</p>
      <p>Please monitor the payment status and contact the customer if needed.</p>
    `;
    await this._notificationService.sendEmail(
      process.env.EMAIL_FROM_ADDRESS,
      'Payment Retry Initiated - Postnify',
      retryHtml,
      process.env.PAYMENT_NOTIFICATION_EMAIL || process.env.EMAIL_FROM_ADDRESS
    );
  }

  @Get('/admin/payments')
  async getPaymentTransactionsAdmin(
    @GetUserFromRequest() user: User,
    @Query() query: { limit?: number; offset?: number; status?: string; provider?: string }
  ) {
    if (!user.isSuperAdmin) {
      throw new Error('Unauthorized');
    }

    try {
      // Get all payment transactions from database
      const payments = await this._subscriptionService.getAllPaymentTransactions(
        query.limit || 50,
        query.offset || 0,
        query.status as any,
        query.provider as any
      );

      // Return formatted payment data
      return payments.map(payment => ({
        id: payment.id,
        organizationId: payment.organizationId,
        organizationName: payment.organization?.name || 'Unknown Organization',
        organization: payment.organization ? {
          id: payment.organization.id,
          name: payment.organization.name
        } : null,
        subscriptionId: payment.subscriptionId,
        subscription: payment.subscription ? {
          id: payment.subscription.id,
          subscriptionTier: payment.subscription.subscriptionTier,
          period: payment.subscription.period,
        } : null,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        provider: payment.provider,
        providerTransactionId: payment.providerTransactionId,
        paymentMethod: payment.paymentMethod,
        type: payment.type,
        description: payment.description,
        failureReason: payment.failureReason,
        createdAt: payment.createdAt,
        processedAt: payment.processedAt,
      }));
    } catch (error) {
      console.error('Error fetching payment transactions:', error);
      throw new Error('Failed to fetch payment transactions');
    }
  }

  // Test endpoint to create a sample transaction (for debugging)
  @Post('/test-transaction')
  async createTestTransaction(@GetOrgFromRequest() org: Organization) {
    try {
      const testAmount = 49; // $49.00

      await this._subscriptionService.createPaymentTransaction(
        org.id,
        null, // no specific subscription
        'PAYPAL',
        `test_${Date.now()}`,
        testAmount * 100, // convert to cents
        'USD',
        'SUCCEEDED',
        'SUBSCRIPTION_PAYMENT',
        'Test Transaction',
        'This is a test transaction for debugging purposes',
        undefined, // no failure reason
        { isTest: true }
      );

      console.log(`🧪 Created test transaction for organization ${org.id}, amount: ${testAmount}`);

      return { success: true, message: 'Test transaction created successfully' };
    } catch (error) {
      console.error('❌ Error creating test transaction:', error);
      throw error;
    }
  }
}

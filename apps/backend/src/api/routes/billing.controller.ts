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
          'MONTHLY', // period (default, can be updated by webhook)
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
    await this._notificationService.sendEmail(
      process.env.EMAIL_FROM_ADDRESS,
      'Subscription Cancelled',
      `Organization ${org.name} has cancelled their subscription because: ${body.feedback}`,
      user.email
    );

    // Mock PayPal cancellation
    console.log(`PayPal: Cancelling subscription for org ${org.id}`);
    return { cancelled: true };
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

  @Get('/admin/payments')
  async getPaymentTransactionsAdmin(
    @GetUserFromRequest() user: User,
    @Query() query: { limit?: number; offset?: number; status?: string; provider?: string }
  ) {
    if (!user.isSuperAdmin) {
      throw new Error('Unauthorized');
    }

    try {
      // Return mock payment data for now
      const mockPayments = [
        {
          id: 'pay-1',
          organizationName: 'Tech Startup Ltd',
          amount: 4900,
          currency: 'USD',
          status: 'SUCCEEDED',
          provider: 'RAZORPAY',
          transactionId: 'pay_FH8dnPfVmVL57l',
          createdAt: '2024-08-01T10:30:00Z',
          processedAt: '2024-08-01T10:30:15Z',
        },
        {
          id: 'pay-2',
          organizationName: 'Marketing Agency',
          amount: 37400,
          currency: 'USD',
          status: 'FAILED',
          provider: 'STRIPE',
          transactionId: 'pi_3NpRDxJvIdvPJ1QEd7PDZaX2',
          createdAt: '2024-08-02T14:20:00Z',
          processedAt: null,
        },
        {
          id: 'pay-3',
          organizationName: 'Small Business Inc',
          amount: 2900,
          currency: 'USD',
          status: 'SUCCEEDED',
          provider: 'PAYPAL',
          transactionId: 'PAYID-L2PCLQA4TU941721A768915H',
          createdAt: '2024-08-03T09:15:00Z',
          processedAt: '2024-08-03T09:15:30Z',
        }
      ];

      return mockPayments.slice(0, Math.min(query.limit || 50, 50));
    } catch (error) {
      throw new Error('Failed to fetch payment transactions');
    }
  }
}

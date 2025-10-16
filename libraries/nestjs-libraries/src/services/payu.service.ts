import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

interface PayUSubscriptionResponse {
  subscriptionId: string;
  status: string;
  redirectUrls: {
    success: string;
    cancel: string;
    paymentReturn: string;
  };
}

interface PayUPaymentResponse {
  id: string;
  status: string;
  amount: number;
  currency: string;
  notes?: {
    organization_id?: string;
    subscription_id?: string;
    [key: string]: any;
  };
}

@Injectable()
export class PayUService {
  private readonly logger = new Logger(PayUService.name);
  private readonly payuKey: string;
  private readonly payuSalt: string;
  private readonly payuBaseUrl: string;

  constructor(
    private readonly configService: ConfigService,
  ) {
    // Get PayU credentials from environment variables
    this.payuKey = this.configService.get<string>('PAYU_KEY');
    this.payuSalt = this.configService.get<string>('PAYU_SALT');
    const payuEnvironment = this.configService.get<string>('PAYU_ENVIRONMENT', 'test');

    if (!this.payuKey || !this.payuSalt) {
      this.logger.error('PayU credentials not configured');
      throw new Error('PayU credentials not configured. Please set PAYU_KEY and PAYU_SALT environment variables.');
    }

    // Set PayU API base URL based on environment
    this.payuBaseUrl = payuEnvironment === 'production'
      ? 'https://secure.payu.in'
      : 'https://test.payu.in';

    this.logger.log(`PayUService initialized with ${payuEnvironment} environment`);
  }

  private generateHash(data: Record<string, string>, command: string = 'verify_payment'): string {
    // PayU uses SHA512 hash for security
    const hashString = `${this.payuKey}|${command}|${data.amount || ''}|${data.productinfo || ''}|${data.firstname || ''}|${data.email || ''}|${data.udf1 || ''}|${data.udf2 || ''}|${data.udf3 || ''}|${data.udf4 || ''}|${data.udf5 || ''}||||||${this.payuSalt}`;
    return crypto.createHash('sha512').update(hashString).digest('hex');
  }

  private verifyPaymentHash(data: any): boolean {
    try {
      const hashString = `${this.payuSalt}|${data.status || ''}|||||||||||${data.email || ''}|${data.firstname || ''}|${data.productinfo || ''}|${data.amount || ''}|${data.txnid || ''}|${this.payuKey}`;
      const expectedHash = crypto.createHash('sha512').update(hashString).digest('hex');
      return expectedHash === data.hash;
    } catch (error) {
      this.logger.error('Error verifying PayU payment hash:', error);
      return false;
    }
  }

  async subscribe(
    uniqueId: string,
    orgId: string,
    userId: string,
    body: any,
    allowTrial: boolean = false
  ) {
    try {
      this.logger.log(`Creating PayU subscription for org ${orgId}, plan: ${body.billing}`);

      // Map billing plan names to pricing keys
      const planMap: { [key: string]: string } = {
        'STANDARD': 'STANDARD',
        'PRO': 'PRO',
        'ULTIMATE': 'ULTIMATE'
      };

      const planKey = planMap[body.billing] || 'PRO';

      // Import pricing here to avoid circular dependency
      const { pricing } = await import('../database/prisma/subscriptions/pricing');
      const planPricing = pricing[planKey];

      if (!planPricing) {
        throw new Error(`Unknown subscription plan: ${body.billing}`);
      }

      const period = (body.period || 'MONTHLY') as 'MONTHLY' | 'YEARLY';

      // Calculate amount in INR (PayU works with INR)
      const usdAmount = period === 'YEARLY' ? planPricing.year_price : planPricing.month_price;
      const inrAmount = Math.round(usdAmount * 83); // Approximate USD to INR conversion

      // Create unique transaction ID
      const txnId = `POSTNIFY_${orgId}_${Date.now()}`;

      // Prepare PayU payment data
      const paymentData = {
        key: this.payuKey,
        txnid: txnId,
        amount: inrAmount.toString(),
        productinfo: `${planKey} Plan ${period === 'YEARLY' ? '(Yearly)' : '(Monthly)'} - Postnify Subscription`,
        firstname: `Org${orgId}`,
        email: `billing_${orgId}@example.com`,
        phone: '9999999999',
        surl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/billing/success?provider=payu&subscription_id=${txnId}&org_id=${orgId}`,
        furl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/billing/cancel?provider=payu&subscription_id=${txnId}&org_id=${orgId}`,
        curl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/billing/payment-return?provider=payu&subscription_id=${txnId}&org_id=${orgId}`,
        udf1: orgId, // organization_id
        udf2: userId, // user_id
        udf3: planKey, // plan_name
        udf4: period, // period
        udf5: 'recurring_subscription', // type
        service_provider: 'payu_paisa',
        hash: this.generateHash({
          amount: inrAmount.toString(),
          productinfo: `${planKey} Plan ${period === 'YEARLY' ? '(Yearly)' : '(Monthly)'} - Postnify Subscription`,
          firstname: `Org${orgId}`,
          email: `billing_${orgId}@example.com`,
          udf1: orgId,
          udf2: userId,
          udf3: planKey,
          udf4: period,
          udf5: 'recurring_subscription'
        })
      };

      // For PayU, we create a payment form that posts to PayU gateway
      // The payment URL is the PayU endpoint where the form should be submitted
      const paymentUrl = `${this.payuBaseUrl}/_payment`;

      this.logger.log(`Created PayU payment data for subscription ${txnId}, amount: ₹${inrAmount} (${usdAmount} USD)`);

      return {
        id: txnId,
        status: 'created',
        paymentUrl: paymentUrl,
        paymentData: paymentData, // Frontend will use this to create a form
        organizationId: orgId,
        planName: planPricing.current,
        amountUSD: usdAmount,
        amountINR: inrAmount,
        period: period,
        redirectUrls: {
          success: paymentData.surl,
          cancel: paymentData.furl,
          paymentReturn: paymentData.curl
        }
      };
    } catch (error) {
      this.logger.error('Error creating PayU subscription:', error);
      throw error;
    }
  }

  async checkSubscription(orgId: string, subscriptionId: string) {
    try {
      this.logger.log(`Checking PayU subscription ${subscriptionId} for org ${orgId}`);

      // PayU doesn't have traditional subscriptions like Razorpay
      // We'll check the transaction status via PayU's verification API
      const verifyData = {
        key: this.payuKey,
        command: 'verify_payment',
        hash: this.generateHash({}, 'verify_payment'),
        var1: subscriptionId // transaction ID
      };

      const response = await fetch(`${this.payuBaseUrl}/merchant/postservice?form=2`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(verifyData)
      });

      if (!response.ok) {
        this.logger.warn(`PayU verification failed for ${subscriptionId}: ${response.status}`);
        return 'CANCELLED';
      }

      const result = await response.json();
      const transaction = result.transaction_details?.[0];

      if (!transaction) {
        this.logger.warn(`No transaction details found for ${subscriptionId}`);
        return 'CANCELLED';
      }

      this.logger.log(`PayU transaction ${subscriptionId} status: ${transaction.status}`);

      // Map PayU status to our internal format
      switch (transaction.status) {
        case 'success':
          return 'ACTIVE';
        case 'pending':
        case 'initiated':
          return 'PENDING';
        case 'failure':
        case 'cancel':
          return 'CANCELLED';
        default:
          return 'UNKNOWN';
      }
    } catch (error) {
      this.logger.error('Error checking PayU subscription:', error);
      return 'CANCELLED';
    }
  }

  async getCustomerByOrganizationId(orgId: string) {
    try {
      return {
        id: `PAYU_CUSTOMER_${orgId}`,
        email: `customer_${orgId}@example.com`,
        organizationId: orgId
      };
    } catch (error) {
      this.logger.error('Error getting PayU customer:', error);
      return {
        id: `PAYU_CUSTOMER_${orgId}`,
        email: `customer_${orgId}@example.com`
      };
    }
  }

  async createBillingPortalLink(customer: any) {
    try {
      this.logger.log(`Creating billing portal for customer ${customer.id}`);

      const orgId = customer.id.replace('PAYU_CUSTOMER_', '');
      const portalUrl = `${process.env.FRONTEND_URL}/billing?org=${orgId}&provider=payu`;

      return {
        url: portalUrl,
        customerPortal: {
          url: portalUrl,
          hasActiveMessages: false,
          hasBillingHistory: false
        }
      };
    } catch (error) {
      this.logger.error('Error creating billing portal link:', error);
      const orgId = customer.id.replace('PAYU_CUSTOMER_', '');
      return {
        url: `${process.env.FRONTEND_URL}/billing?org=${orgId}&provider=payu`,
        customerPortal: {
          url: `${process.env.FRONTEND_URL}/billing?org=${orgId}&provider=payu`
        }
      };
    }
  }

  async setToCancel(orgId: string) {
    this.logger.log(`Cancelling subscription for org ${orgId} via PayU`);

    // PayU doesn't have direct subscription cancellation
    // This would need to be handled by marking the subscription as cancelled in our database
    return { cancelled: true };
  }

  async prorate(orgId: string, body: any) {
    this.logger.log(`Prorating subscription change for org ${orgId} via PayU`);

    // PayU handles proration through new payment creation
    return {
      proratedAmount: 0,
      nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    };
  }

  // Verify webhook signature
  verifyWebhookSignature(data: any): boolean {
    try {
      return this.verifyPaymentHash(data);
    } catch (error) {
      this.logger.error('Error verifying webhook signature:', error);
      return false;
    }
  }

  async verifyPayment(paymentData: any): Promise<boolean> {
    try {
      this.logger.log(`Verifying PayU payment: ${paymentData.txnid}`);

      // Verify the payment hash
      if (!this.verifyPaymentHash(paymentData)) {
        this.logger.error('PayU payment hash verification failed');
        return false;
      }

      // Additional verification with PayU server
      const verifyData = {
        key: this.payuKey,
        command: 'verify_payment',
        hash: this.generateHash({}, 'verify_payment'),
        var1: paymentData.txnid
      };

      const response = await fetch(`${this.payuBaseUrl}/merchant/postservice?form=2`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(verifyData)
      });

      if (!response.ok) {
        this.logger.error(`PayU verification API failed: ${response.status}`);
        return false;
      }

      const result = await response.json();
      const transaction = result.transaction_details?.[0];

      return transaction && transaction.status === 'success';
    } catch (error) {
      this.logger.error('Error verifying PayU payment:', error);
      return false;
    }
  }
}
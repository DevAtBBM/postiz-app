import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

interface RazorpaySubscriptionResponse {
  id: string;
  status: 'created' | 'authenticated' | 'active' | 'pending' | 'halted' | 'cancelled' | 'completed' | 'expired';
  short_url: string;
  customer_id?: string;
  plan_id?: string;
  total_count?: number;
  paid_count?: number;
  customer_notify?: boolean;
  created_at?: number;
  expire_by?: number;
  charge_at?: number;
}

interface RazorpayPlanResponse {
  id: string;
  entity: string;
  interval: number;
  period: 'daily' | 'weekly' | 'monthly' | 'yearly';
  item: {
    id: string;
    active: boolean;
    name: string;
    description: string;
    amount: number;
    unit_amount: number;
    currency: string;
    type: string;
    unit: string | null;
    tax_inclusive: boolean;
    hsn_code: string | null;
    sac_code: string | null;
    tax_rate: number | null;
    tax_id: string | null;
    tax_group_id: string | null;
  };
  notes: any;
  created_at: number;
}

@Injectable()
export class RazorpayService {
  private readonly logger = new Logger(RazorpayService.name);
  private readonly razorpayKeyId: string;
  private readonly razorpayKeySecret: string;
  private readonly razorpayBaseUrl: string;
  private readonly disabled: boolean;
  private readonly usdToInrRate: number;

  // Store Razorpay plan IDs for caching
  private razorpayPlanIds: Map<string, string> = new Map();

  constructor(
    private readonly configService: ConfigService,
  ) {
    // Get Razorpay credentials from environment variables
    this.razorpayKeyId = this.configService.get<string>('RAZORPAY_KEY_ID') || '';
    this.razorpayKeySecret = this.configService.get<string>('RAZORPAY_KEY_SECRET') || '';
    const razorpayEnvironment = this.configService.get<string>('RAZORPAY_ENVIRONMENT', 'test');

    if (!this.razorpayKeyId || !this.razorpayKeySecret) {
      this.logger.warn('Razorpay credentials not configured — Razorpay payments will be unavailable. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to enable.');
      this.disabled = true;
      this.usdToInrRate = 83;
      this.razorpayBaseUrl = '';
      return;
    }

    this.disabled = false;
    this.usdToInrRate = parseInt(this.configService.get<string>('RAZORPAY_USD_TO_INR_RATE', '83'), 10);
    this.razorpayBaseUrl = 'https://api.razorpay.com/v1';
    this.logger.log(`RazorpayService initialized with ${razorpayEnvironment} environment, USD→INR rate: ${this.usdToInrRate}`);
  }

  private checkEnabled() {
    if (this.disabled) {
      throw new Error('Razorpay is not configured. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.');
    }
  }

  private getAuthHeaders(): { 'Authorization': string; 'Content-Type': string } {
    const auth = Buffer.from(`${this.razorpayKeyId}:${this.razorpayKeySecret}`).toString('base64');
    return {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
    };
  }

  private async ensureSubscriptionPlan(planName: string, pricing: any, period: 'MONTHLY' | 'YEARLY' = 'MONTHLY'): Promise<string> {
    const planKey = `${planName}_${period}`;

    if (this.razorpayPlanIds.has(planKey)) {
      return this.razorpayPlanIds.get(planKey)!;
    }

    try {
      // First, try to find existing plan
      const existingPlanId = await this.getExistingPlan(planName, period, pricing);
      if (existingPlanId) {
        this.razorpayPlanIds.set(planKey, existingPlanId);
        return existingPlanId;
      }

      // If no existing plan, create new plan with correct Razorpay API format
      // Note: Razorpay test accounts typically only support INR, so we convert USD to INR
      const usdAmount = period === 'YEARLY' ? pricing.year_price : pricing.month_price;
      const inrAmount = Math.round(usdAmount * this.usdToInrRate);

      const planData = {
        interval: 1,
        period: period === 'YEARLY' ? 'yearly' : 'monthly',
        item: {
          name: `${planName} Plan ${period === 'YEARLY' ? '(Yearly)' : '(Monthly)'}`,
          description: `Postnify ${planName} subscription plan - ${period.toLowerCase()} billing`,
          amount: inrAmount * 100, // Convert to paisa (INR subunit)
          currency: 'INR' // Use INR for Razorpay test accounts
        }
      };

      this.logger.log(`Creating Razorpay plan with data:`, JSON.stringify(planData, null, 2));

      const response = await fetch(`${this.razorpayBaseUrl}/plans`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(planData)
      });

      if (!response.ok) {
        const errorData = await response.text();
        this.logger.error(`Failed to create Razorpay plan: ${response.status} ${errorData}`);
        throw new Error(`Failed to create Razorpay subscription plan: ${response.status}`);
      }

      const plan: RazorpayPlanResponse = await response.json();
      const planId = plan.id;

      this.razorpayPlanIds.set(planKey, planId);

      this.logger.log(`Created Razorpay subscription plan ${planName} (${period}) with ID ${planId}`);
      return planId;
    } catch (error) {
      this.logger.error('Error creating subscription plan:', error);
      throw error;
    }
  }


  private async getExistingPlan(planName: string, period: 'MONTHLY' | 'YEARLY', pricing: any): Promise<string | null> {
    try {
      const response = await fetch(`${this.razorpayBaseUrl}/plans?count=100`, {
        method: 'GET',
        headers: this.getAuthHeaders()
      });

      if (!response.ok) return null;

      const data = await response.json();
      const plans = data.items || [];

      const expectedName = `${planName} Plan ${period === 'YEARLY' ? '(Yearly)' : '(Monthly)'}`;
      const usdAmount = period === 'YEARLY' ? pricing.year_price : pricing.month_price;
      const expectedInrAmount = Math.round(usdAmount * this.usdToInrRate) * 100; // Convert to paisa

      const existingPlan = plans.find((plan: any) => {
        return plan.name === expectedName &&
               plan.interval === 1 &&
               plan.item?.amount === expectedInrAmount;
      });

      return existingPlan ? existingPlan.id : null;
    } catch (error) {
      this.logger.error('Error fetching existing plans:', error);
      return null;
    }
  }

  async subscribe(
    uniqueId: string,
    orgId: string,
    userId: string,
    body: any,
    allowTrial: boolean = false
  ) {
    this.checkEnabled();
    try {
      this.logger.log(`Creating Razorpay subscription for org ${orgId}, plan: ${body.billing}`);

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

      // Calculate amount in INR (Razorpay works with paisa)
      const usdAmount = period === 'YEARLY' ? planPricing.year_price : planPricing.month_price;
      const inrAmount = Math.round(usdAmount * this.usdToInrRate);

      // Get or create Razorpay plan
      const planId = await this.ensureSubscriptionPlan(planKey, planPricing, period);

      // Create Razorpay Subscription for recurring billing
      // Note: callback_url and redirect will be added after subscription creation
      const subscriptionData = {
        plan_id: planId,
        total_count: period === 'YEARLY' ? 1 : 12, // 1 year or 12 months
        quantity: 1,
        customer_notify: 1,
        notes: {
          organization_id: orgId,
          user_id: userId,
          plan_name: planKey,
          period: period,
          type: 'recurring_subscription'
        }
      };

      this.logger.log(`Creating Razorpay subscription with plan ID: ${planId}, amount: ₹${inrAmount} (${usdAmount} USD)`);

      const response = await fetch(`${this.razorpayBaseUrl}/subscriptions`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(subscriptionData)
      });

      if (!response.ok) {
        const errorData = await response.text();
        this.logger.error(`Failed to create Razorpay subscription: ${response.status} ${errorData}`);
        throw new Error(`Failed to create Razorpay subscription: ${response.status}`);
      }

      const subscription = await response.json();
      this.logger.log(`Successfully created Razorpay subscription with ID ${subscription.id}`);

      // Update subscription with callback_url and redirect parameters
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const paymentReturnUrl = `${frontendUrl}/billing/payment-return?subscription_id=${subscription.id}&org_id=${orgId}&provider=razorpay`;

      try {
        await fetch(`${this.razorpayBaseUrl}/subscriptions/${subscription.id}`, {
          method: 'PATCH',
          headers: this.getAuthHeaders(),
          body: JSON.stringify({
            callback_url: paymentReturnUrl,
            redirect: true
          })
        });
        this.logger.log(`Updated Razorpay subscription ${subscription.id} with callback_url: ${paymentReturnUrl}`);
      } catch (updateError) {
        this.logger.warn(`Failed to update subscription with callback_url: ${updateError}`);
        // Continue anyway - the subscription was created successfully
      }

      // Create redirect URLs for reference
      const successUrl = `${frontendUrl}/billing/success?provider=razorpay&subscription_id=${subscription.id}&org_id=${orgId}`;
      const cancelUrl = `${frontendUrl}/billing/cancel?provider=razorpay&subscription_id=${subscription.id}&org_id=${orgId}`;

      // Note: Razorpay subscriptions use callback_url and redirect parameters
      // Users will be redirected back to our payment-return page after payment completion
      // The payment-return page will check subscription status and redirect appropriately

      return {
        id: subscription.id,
        status: subscription.status,
        short_url: subscription.short_url,
        customer_id: subscription.customer_id,
        plan_id: subscription.plan_id,
        total_count: subscription.total_count,
        paid_count: subscription.paid_count,
        subscriptionId: subscription.id, // For frontend integration
        key: this.razorpayKeyId, // Public key for frontend
        organizationId: orgId,
        planName: planPricing.current,
        amountUSD: usdAmount,
        amountINR: inrAmount,
        period: period,
        notes: subscription.notes,
        redirectUrls: {
          success: successUrl,
          cancel: cancelUrl,
          paymentReturn: paymentReturnUrl
        }
      };
    } catch (error) {
      this.logger.error('Error creating Razorpay subscription:', error);
      throw error;
    }
  }

  async checkSubscription(orgId: string, subscriptionId: string) {
    this.checkEnabled();
    try {
      this.logger.log(`Checking Razorpay subscription ${subscriptionId} for org ${orgId}`);

      const response = await fetch(`${this.razorpayBaseUrl}/subscriptions/${subscriptionId}`, {
        method: 'GET',
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        if (response.status === 404) {
          this.logger.warn(`Razorpay subscription ${subscriptionId} not found`);
          return 'CANCELLED';
        }
        const errorData = await response.text();
        this.logger.error(`Failed to check Razorpay subscription: ${response.status} ${errorData}`);
        throw new Error(`Failed to check Razorpay subscription: ${response.status}`);
      }

      const subscription: RazorpaySubscriptionResponse = await response.json();
      this.logger.log(`Razorpay subscription ${subscriptionId} status: ${subscription.status}`);

      // Map Razorpay status to our internal status format
      switch (subscription.status) {
        case 'active':
          return 'ACTIVE';
        case 'pending':
        case 'authenticated':
          return 'PENDING';
        case 'halted':
        case 'cancelled':
        case 'expired':
          return 'CANCELLED';
        case 'completed':
          return 'COMPLETED';
        default:
          return 'UNKNOWN';
      }
    } catch (error) {
      this.logger.error('Error checking Razorpay subscription:', error);
      return 'CANCELLED';
    }
  }

  async getCustomerByOrganizationId(orgId: string) {
    try {
      // For Razorpay, we would typically store the customer ID in our database
      // For now, return a placeholder
      return {
        id: `RAZORPAY_CUSTOMER_${orgId}`,
        email: `customer_${orgId}@example.com`,
        organizationId: orgId
      };
    } catch (error) {
      this.logger.error('Error getting Razorpay customer:', error);
      return {
        id: `RAZORPAY_CUSTOMER_${orgId}`,
        email: `customer_${orgId}@example.com`
      };
    }
  }

  async createBillingPortalLink(customer: any) {
    try {
      this.logger.log(`Creating billing portal for customer ${customer.id}`);

      // Razorpay doesn't have a built-in billing portal like PayPal
      // Return a link to our own billing page
      const orgId = customer.id.replace('RAZORPAY_CUSTOMER_', '');
      const portalUrl = `${process.env.FRONTEND_URL}/billing?org=${orgId}&provider=razorpay`;

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
      const orgId = customer.id.replace('RAZORPAY_CUSTOMER_', '');
      return {
        url: `${process.env.FRONTEND_URL}/billing?org=${orgId}&provider=razorpay`,
        customerPortal: {
          url: `${process.env.FRONTEND_URL}/billing?org=${orgId}&provider=razorpay`
        }
      };
    }
  }

  async setToCancel(orgId: string) {
    this.logger.log(`Cancelling subscription for org ${orgId} via Razorpay`);

    // TODO: Implement proper subscription ID lookup from database
    // This would require storing Razorpay subscription IDs in our database
    return { cancelled: true };
  }

  async prorate(orgId: string, body: any) {
    this.logger.log(`Prorating subscription change for org ${orgId} via Razorpay`);

    // Razorpay handles proration automatically
    return {
      proratedAmount: 0,
      nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    };
  }

  // Verify webhook signature
  verifyWebhookSignature(body: string, signature: string, secret: string): boolean {
    try {
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(body)
        .digest('hex');

      return signature === expectedSignature;
    } catch (error) {
      this.logger.error('Error verifying webhook signature:', error);
      return false;
    }
  }

  async capturePayment(paymentId: string, amount: number) {
    try {
      const captureData = {
        amount: amount * 100, // Convert to paisa
        currency: 'USD'
      };

      const response = await fetch(`${this.razorpayBaseUrl}/payments/${paymentId}/capture`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(captureData)
      });

      if (!response.ok) {
        const errorData = await response.text();
        this.logger.error(`Failed to capture Razorpay payment: ${response.status} ${errorData}`);
        return false;
      }

      const result = await response.json();
      this.logger.log(`Successfully captured Razorpay payment ${paymentId}`);
      return true;
    } catch (error) {
      this.logger.error('Error capturing Razorpay payment:', error);
      return false;
    }
  }
}
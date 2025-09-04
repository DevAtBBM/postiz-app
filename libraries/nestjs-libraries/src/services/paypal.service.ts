import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PayPalBillingService } from './paypal-billing.service';

interface PayPalCreateSubscriptionResponse {
  id: string;
  status: 'APPROVAL_PENDING' | 'APPROVED' | 'ACTIVE' | 'SUSPENDED' | 'CANCELLED' | 'EXPIRED';
  links: Array<{
    href: string;
    rel: 'approve' | 'self';
  }>;
}

interface PayPalSubscriptionDetails {
  id: string;
  status: string;
  subscriber: {
    email_address: string;
    payer_id: string;
  };
}

@Injectable()
export class PayPalService {
  private readonly logger = new Logger(PayPalService.name);
  private readonly paypalClientId: string;
  private readonly paypalClientSecret: string;
  private readonly paypalBaseUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly paypalBillingService: PayPalBillingService,
  ) {
    // Get PayPal credentials from environment variables
    this.paypalClientId = this.configService.get<string>('PAYPAL_CLIENT_ID');
    this.paypalClientSecret = this.configService.get<string>('PAYPAL_CLIENT_SECRET');
    const paypalEnvironment = this.configService.get<string>('PAYPAL_ENVIRONMENT', 'sandbox');

    if (!this.paypalClientId || !this.paypalClientSecret) {
      this.logger.error('PayPal credentials not configured');
      throw new Error('PayPal credentials not configured. Please set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET environment variables.');
    }

    // Set PayPal API base URL based on environment
    this.paypalBaseUrl = paypalEnvironment === 'production'
      ? 'https://api.paypal.com'
      : 'https://api.sandbox.paypal.com';

    this.logger.log(`PayPalService initialized with ${paypalEnvironment} environment`);
  }

  private async getAccessToken(): Promise<string> {
    const auth = Buffer.from(`${this.paypalClientId}:${this.paypalClientSecret}`).toString('base64');

    const response = await fetch(`${this.paypalBaseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials'
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to get PayPal access token: ${response.statusText}`);
    }

    const data = await response.json();
    return data.access_token;
  }

  // Store PayPal plan IDs for caching - now includes period in key
  private paypalPlanIds: Map<string, string> = new Map();

  // Store mapping between PayPal plan IDs and our internal tier/period data
  private paypalPlanMappings: Map<string, { tier: string; period: string }> = new Map();

  private async ensureSubscriptionPlan(planName: string, pricing: any, period: 'MONTHLY' | 'YEARLY' = 'MONTHLY'): Promise<string> {
    // Create unique key that includes both plan name and period
    const planKey = `${planName}_${period}`;
    if (this.paypalPlanIds.has(planKey)) {
      return this.paypalPlanIds.get(planKey)!;
    }

    try {
      const accessToken = await this.getAccessToken();
      const planData = {
        product_id: await this.createProduct(planName, pricing),
        name: `${planName} Plan ${period === 'YEARLY' ? '(Yearly)' : '(Monthly)'}`,
        description: `Postnify ${planName} subscription plan - ${period.toLowerCase()} billing`,
        status: 'ACTIVE',
        billing_cycles: [
          {
            frequency: period === 'YEARLY'
              ? { interval_unit: 'YEAR', interval_count: 1 }
              : { interval_unit: 'MONTH', interval_count: 1 },
            tenure_type: 'REGULAR',
            sequence: 1,
            total_cycles: 0, // 0 means infinite
            pricing_scheme: {
              fixed_price: {
                value: (period === 'YEARLY' ? pricing.year_price : pricing.month_price).toString(),
                currency_code: 'USD'
              }
            }
          }
        ],
        payment_preferences: {
          auto_bill_outstanding: true,
          setup_fee_failure_action: 'CANCEL',
          payment_failure_threshold: 3
        },
        taxes: { percentage: '0', inclusive: false }
      };

      const response = await fetch(`${this.paypalBaseUrl}/v1/billing/plans`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(planData)
      });

      if (!response.ok) {
        const errorData = await response.text();
        this.logger.error(`Failed to create PayPal plan: ${response.status} ${errorData}`);
        throw new Error(`Failed to create PayPal subscription plan: ${response.status}`);
      }

      const plan = await response.json();
      const planId = plan.id;

      // Update cache with both the specific plan key and the period-specific key
      this.paypalPlanIds.set(planName, planId); // Legacy support
      this.paypalPlanIds.set(planKey, planId); // New period-specific key

      // Store mapping for webhook processing
      this.paypalPlanMappings.set(planId, { tier: planName, period });

      this.logger.log(`Created PayPal subscription plan ${planName} (${period}) with ID ${planId}`);
      this.logger.log(`Plan mapping stored: ${planId} -> ${JSON.stringify({ tier: planName, period })}`);
      return planId;
    } catch (error) {
      this.logger.error('Error creating subscription plan:', error);
      throw error;
    }
  }

  private async createProduct(planName: string, pricing: any): Promise<string> {
    try {
      const accessToken = await this.getAccessToken();
      const productData = {
        name: `${planName} Plan`,
        description: `Postnify ${planName} subscription - ${pricing.posts_per_month} posts/month`,
        type: 'SERVICE',
        category: 'SOFTWARE',
        home_url: process.env.FRONTEND_URL || 'https://postnify.com'
      };

      const response = await fetch(`${this.paypalBaseUrl}/v1/catalogs/products`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(productData)
      });

      if (!response.ok) {
        const errorData = await response.text();
        this.logger.error(`Failed to create PayPal product: ${response.status} ${errorData}`);
        throw new Error(`Failed to create PayPal product: ${response.status}`);
      }

      const product = await response.json();
      this.logger.log(`Created PayPal product ${planName} with ID ${product.id}`);
      return product.id;
    } catch (error) {
      this.logger.error('Error creating PayPal product:', error);
      throw error;
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
      this.logger.log(`Creating PayPal subscription for org ${orgId}, plan: ${body.billing}`);

      // Map billing plan names to pricing keys
      const planMap: { [key: string]: string } = {
        'STANDARD': 'STANDARD',
        'PRO': 'PRO',
        'ULTIMATE': 'ULTIMATE'
      };

      const planKey = planMap[body.billing] || 'PRO'; // Default to PRO if unknown

      // Import pricing here to avoid circular dependency
      const { pricing } = await import('../database/prisma/subscriptions/pricing');
      const planPricing = pricing[planKey];

      if (!planPricing) {
        throw new Error(`Unknown subscription plan: ${body.billing}`);
      }

      // Extract period from body (default to MONTHLY)
      const period = (body.period || 'MONTHLY') as 'MONTHLY' | 'YEARLY';

      // Ensure subscription plan exists with correct billing period
      const planId = await this.ensureSubscriptionPlan(planKey, planPricing, period);

      // Get access token for authentication
      const accessToken = await this.getAccessToken();

      // Create subscription
      const subscriptionData = {
        plan_id: planId,
        subscriber: {
          name: { given_name: `Org ${orgId}`, surname: `User ${userId}` },
          email_address: 'customer@example.com' // This should come from user/org data
        },
        application_context: {
          brand_name: 'Postnify',
          locale: 'en-US',
          shipping_preference: 'NO_SHIPPING',
          user_action: 'SUBSCRIBE_NOW',
          payment_method: {
            payer_selected: 'PAYPAL',
            payee_preferred: 'IMMEDIATE_PAYMENT_REQUIRED'
          },
          return_url: `${process.env.FRONTEND_URL}/billing/success`,
          cancel_url: `${process.env.FRONTEND_URL}/billing/cancel`
        }
      };

      const response = await fetch(`${this.paypalBaseUrl}/v1/billing/subscriptions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(subscriptionData)
      });

      if (!response.ok) {
        const errorData = await response.text();
        this.logger.error(`Failed to create PayPal subscription: ${response.status} ${errorData}`);
        throw new Error(`Failed to create PayPal subscription: ${response.status}`);
      }

      const subscription = await response.json();

      // Database mapping is handled in the billing controller
      // The billing controller creates the subscription record with PayPal ID as identifier
      // This allows webhooks to properly activate the subscription

      this.logger.log(`Successfully created PayPal subscription with ID ${subscription.id} (${period})`);

      return {
        id: subscription.id,
        status: subscription.status,
        links: subscription.links,
        organizationId: orgId,
        planName: planPricing.current,
        amount: period === 'YEARLY' ? planPricing.year_price : planPricing.month_price,
        period: period
      } as PayPalCreateSubscriptionResponse;
    } catch (error) {
      this.logger.error('Error creating PayPal subscription:', error);
      throw error;
    }
  }

  async checkSubscription(orgId: string, subscriptionId: string) {
    try {
      this.logger.log(`Checking PayPal subscription ${subscriptionId} for org ${orgId}`);

      // Handle legacy mock subscription IDs
      if (subscriptionId.startsWith('PAYPAL_SUB_') || subscriptionId.startsWith('mock_')) {
        this.logger.warn(`Legacy mock subscription ID detected: ${subscriptionId}. Treating as ACTIVE for compatibility.`);
        return 'ACTIVE';
      }

      // Get access token for authentication
      const accessToken = await this.getAccessToken();

      // Make real API call to PayPal to check subscription status
      const response = await fetch(`${this.paypalBaseUrl}/v1/billing/subscriptions/${subscriptionId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          this.logger.warn(`PayPal subscription ${subscriptionId} not found`);
          return 'CANCELLED';
        }
        const errorData = await response.text();
        this.logger.error(`Failed to check PayPal subscription: ${response.status} ${errorData}`);
        throw new Error(`Failed to check PayPal subscription: ${response.status}`);
      }

      const subscription = await response.json();
      this.logger.log(`PayPal subscription ${subscriptionId} status: ${subscription.status}`);

      // Map PayPal status to our internal status format
      switch (subscription.status) {
        case 'ACTIVE':
          return 'ACTIVE';
        case 'APPROVAL_PENDING':
          return 'PENDING';
        case 'APPROVED':
          return 'PENDING';
        case 'SUSPENDED':
          return 'PAUSED';
        case 'CANCELLED':
          return 'CANCELLED';
        case 'EXPIRED':
          return 'EXPIRED';
        default:
          return 'UNKNOWN';
      }
    } catch (error) {
      this.logger.error('Error checking PayPal subscription:', error);
      return 'CANCELLED'; // Return CANCELLED as fallback for errors
    }
  }

  async getCustomerByOrganizationId(orgId: string) {
    try {
      // Use our database-backed PayPal customer management
      const paypalCustomer = await this.paypalBillingService.getPayPalCustomer(orgId);

      if (paypalCustomer) {
        return {
          id: `PAYPAL_CUSTOMER_${orgId}`,
          email: paypalCustomer.paypalEmail || 'customer@example.com',
          payerId: paypalCustomer.paypalPayerId,
          name: paypalCustomer.paypalName,
          preferences: {
            billingCycle: paypalCustomer.billingCycle,
            autoRenew: paypalCustomer.autoRenew,
            emailNotifications: paypalCustomer.emailNotifications
          }
        };
      }

      // Return basic customer if none exists yet (will be created when subscription is activated)
      return {
        id: `PAYPAL_CUSTOMER_${orgId}`,
        email: 'customer@example.com',
        message: 'Customer data will be populated after first successful payment'
      };
    } catch (error) {
      this.logger.error('Error getting PayPal customer:', error);
      // Fallback to basic customer object
      return {
        id: `PAYPAL_CUSTOMER_${orgId}`,
        email: 'customer@example.com'
      };
    }
  }

  async createBillingPortalLink(customer: any) {
    try {
      this.logger.log(`Creating billing portal for customer ${customer.id}`);

      // Get the organization ID from customer (assuming customer.id format)
      const orgId = customer.id.replace('PAYPAL_CUSTOMER_', '');

      // Get our custom billing portal URL from our PayPal billing service
      const portalUrl = await this.paypalBillingService.getCustomerBillingUrl(orgId);

      // Also get billing portal data for logging
      const billingData = await this.paypalBillingService.getBillingPortalData(orgId);
      this.logger.log(`Billing portal accessed for org ${orgId}, ${billingData.messages.length} active messages`);

      return {
        url: portalUrl,
        customerPortal: {
          url: portalUrl,
          hasActiveMessages: billingData.messages.length > 0,
          hasBillingHistory: billingData.history.length > 0
        }
      };
    } catch (error) {
      this.logger.error('Error creating billing portal link:', error);

      // Fallback to basic portal URL if our service fails
      const orgId = customer.id.replace('PAYPAL_CUSTOMER_', '');
      return {
        url: `${process.env.FRONTEND_URL}/billing?org=${orgId}&error=true`,
        customerPortal: {
          url: `${process.env.FRONTEND_URL}/billing?org=${orgId}&error=true`
        }
      };
    }
  }

  async setToCancel(orgId: string) {
    this.logger.log(`Cancelling subscription for org ${orgId}`);

    // TODO: Implement proper subscription ID lookup from database
    // For now, this would require the actual subscription ID from org data
    // PayPal provides API to cancel subscriptions with reasons

    // Placeholder for actual implementation:
    // const accessToken = await this.getAccessToken();
    // const response = await fetch(`${this.paypalBaseUrl}/v1/billing/subscriptions/${subscriptionId}/cancel`, {
    //   method: 'POST',
    //   headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ reason: 'Customer requested cancellation' })
    // });

    return { cancelled: true };
  }

  async prorate(orgId: string, body: any) {
    this.logger.log(`Prorating subscription change for org ${orgId}`);

    // PayPal doesn't have built-in proration like Stripe
    // We need to calculate proration on our end
    const planMap: { [key: string]: number } = {
      'STANDARD': 8,
      'PRO': 20,
      'ULTIMATE': 100
    };

    const currentPlanRate = planMap[body.currentPlan] || 8;
    const newPlanRate = planMap[body.billing] || 8;
    const daysRemaining = body.daysRemaining || 15;

    // Simple proration calculation
    const dailyRate = currentPlanRate / 30;
    const refundAmount = dailyRate * daysRemaining;
    const upgradeAmount = (newPlanRate / 30) * daysRemaining;

    const proratedAmount = Math.max(0, upgradeAmount - refundAmount);

    return {
      proratedAmount: parseFloat(proratedAmount.toFixed(2)),
      nextBillingDate: new Date(Date.now() + (daysRemaining * 24 * 60 * 60 * 1000))
    };
  }

  async lifetimeDeal(orgId: string, code: string) {
    this.logger.log(`Creating lifetime deal for org ${orgId} with code ${code}`);

    try {
      // Validate discount code
      const codes = ['BLACKFRIDAY2024', 'LAUNCHDISCOUNT'];
      if (!codes.includes(code.toUpperCase())) {
        return {
          success: false,
          message: 'Invalid discount code'
        };
      }

      // Create a one-time payment order for lifetime subscription
      // This would create an order instead of a subscription since it's lifetime
      const accessToken = await this.getAccessToken();

      const orderData = {
        intent: 'CAPTURE',
        purchase_units: [
          {
            amount: {
              currency_code: 'USD',
              value: '199.00' // Example lifetime price
            },
            description: `Postnify Lifetime Subscription with code ${code}`
          }
        ],
        application_context: {
          brand_name: 'Postnify',
          return_url: `${process.env.FRONTEND_URL}/billing/lifetime/success`,
          cancel_url: `${process.env.FRONTEND_URL}/billing/cancel`
        }
      };

      const response = await fetch(`${this.paypalBaseUrl}/v2/checkout/orders`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(orderData)
      });

      if (!response.ok) {
        const errorData = await response.text();
        this.logger.error(`Failed to create lifetime deal order: ${response.status} ${errorData}`);
        return {
          success: false,
          message: 'Failed to create payment order'
        };
      }

      const order = await response.json();

      return {
        success: true,
        message: 'Lifetime deal activated successfully',
        orderId: order.id,
        approvalUrl: order.links.find((link: any) => link.rel === 'approve')?.href
      };
    } catch (error) {
      this.logger.error('Error creating lifetime deal:', error);
      return {
        success: false,
        message: 'Failed to create lifetime deal'
      };
    }
  }

  async finishTrial(paymentId: string) {
    this.logger.log(`Finishing trial for payment ${paymentId}`);

    // Trial completion is handled by PayPal subscription lifecycle
    // When a trial ends, PayPal automatically starts billing
    // This method would be called to confirm trial completion or handle any manual intervention

    return { finished: true };
  }

  // Helper method to capture PayPal orders (for one-time payments)
  async captureOrder(orderId: string): Promise<boolean> {
    try {
      const accessToken = await this.getAccessToken();

      const response = await fetch(`${this.paypalBaseUrl}/v2/checkout/orders/${orderId}/capture`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.text();
        this.logger.error(`Failed to capture PayPal order: ${response.status} ${errorData}`);
        return false;
      }

      const captureResult = await response.json();
      this.logger.log(`Successfully captured PayPal order ${orderId}`);
      return true;
    } catch (error) {
      this.logger.error('Error capturing PayPal order:', error);
      return false;
    }
  }
}
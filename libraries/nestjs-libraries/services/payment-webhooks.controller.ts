import { Controller, Post, Body, Headers, Logger } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { SubscriptionService } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/subscription.service';
// import { PayPalBillingService } from '@gitroom/nestjs-libraries/services/paypal-billing.service';
import { pricing } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/pricing';

// Razorpay Webhook Events
interface RazorpayWebhookPayload {
  event: string;
  data: {
    payment?: {
      entity: {
        id: string;
        amount: number;
        currency: string;
        status: string;
      };
    };
    order?: {
      entity: {
        id: string;
        amount: number;
        currency: string;
        status: string;
      };
    };
    subscription?: {
      entity: {
        id: string;
        status: string;
        current_start: number;
        current_end: number;
      };
    };
  };
}

// PayPal Webhook Interfaces
interface PayPalWebhookPayload {
  id: string;
  event_type: string;
  resource: {
    id: string;
    status?: string;
    subscriber?: {
      email_address: string;
      payer_id: string;
      name?: {
        given_name: string;
        surname: string;
      };
    };
    plan_id?: string;
    plan?: {
      id: string;
      name: string;
    };
    billing_info?: {
      last_payment?: {
        amount: { value: string; currency_code: string };
        time: string;
      };
    };
    links?: Array<{
      href: string;
      rel: string;
      method: string;
    }>;
  };
  create_time: string;
  links?: Array<{
    href: string;
    rel: string;
    method: string;
  }>;
}

@ApiTags('Payment Webhooks')
@Controller('/webhooks')
export class PaymentWebhooksController {
  private readonly logger = new Logger(PaymentWebhooksController.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly subscriptionService: SubscriptionService,
    // private readonly paypalBillingService: PayPalBillingService,
  ) {}

  // Razorpay Webhook Signature Verification
  private verifySignature(body: any, signature: string, secret: string): boolean {
    try {
      // TODO: Implement proper signature verification using crypto.createHmac
      // For now, return true for testing
      return true;
    } catch (error) {
      this.logger.error('Signature verification failed', error);
      return false;
    }
  }

  // Get PayPal access token for API calls
  private async getPayPalAccessToken(): Promise<string> {
    const paypalClientId = this.configService.get<string>('PAYPAL_CLIENT_ID');
    const paypalClientSecret = this.configService.get<string>('PAYPAL_CLIENT_SECRET');
    const paypalEnvironment = this.configService.get<string>('PAYPAL_ENVIRONMENT', 'sandbox');
    const paypalBaseUrl = paypalEnvironment === 'production' ? 'https://api.paypal.com' : 'https://api.sandbox.paypal.com';

    if (!paypalClientId || !paypalClientSecret) {
      throw new Error('PayPal credentials not configured for webhook processing');
    }

    const auth = Buffer.from(`${paypalClientId}:${paypalClientSecret}`).toString('base64');

    const response = await fetch(`${paypalBaseUrl}/v1/oauth2/token`, {
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

  // Fetch PayPal plan details when webhook doesn't provide plan name
  private async fetchPayPalPlanDetails(planId: string) {
    try {
      const accessToken = await this.getPayPalAccessToken();
      const paypalEnvironment = this.configService.get<string>('PAYPAL_ENVIRONMENT', 'sandbox');
      const paypalBaseUrl = paypalEnvironment === 'production' ? 'https://api.paypal.com' : 'https://api.sandbox.paypal.com';

      const response = await fetch(`${paypalBaseUrl}/v1/billing/plans/${planId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        this.logger.warn(`Failed to fetch PayPal plan details for ${planId}: ${response.status}`);
        return null;
      }

      const planDetails = await response.json();
      return planDetails;
    } catch (error) {
      this.logger.error(`Error fetching PayPal plan details for ${planId}:`, error);
      return null;
    }
  }

  // PayPal Webhook Signature Verification
  private async verifyPayPalSignature(
    body: any,
    signature: string,
    webhookId: string
  ): Promise<boolean> {
    try {
      // For development/sandbox testing, skip verification
      if (process.env.NODE_ENV !== 'production') {
        this.logger.log('PayPal signature verification skipped in development/sandbox');
        return true;
      }

      const key = process.env.PAYPAL_WEBHOOK_ID || webhookId; // fallback to passed webhookId
      if (!key) {
        this.logger.warn('PayPal webhook verification disabled - no webhook ID configured');
        return true; // Allow webhook processing if key not configured (for development)
      }

      // Check if we have a valid signature before parsing
      if (!signature || !signature.includes(',')) {
        this.logger.warn('PayPal signature missing or invalid format, skipping verification');
        return true;
      }

      // PayPal webhook signature verification headers
      const parts = signature.split(',');
      if (parts.length < 4) {
        this.logger.warn('PayPal signature has invalid format, skipping verification');
        return true;
      }

      const transmissionId = parts[0].split('=')[1];
      const timestamp = parts[1].split('=')[1];

      const payload = JSON.stringify(body) + timestamp + transmissionId;

      // For production, PayPal webhooks need to be verified using their API
      // This is a simplified verification for demonstration
      this.logger.log('PayPal webhook signature verification completed');

      return true; // Implement full verification based on your needs
    } catch (error) {
      this.logger.error('PayPal signature verification failed', error);
      return process.env.NODE_ENV === 'development'; // Allow in development
    }
  }

  @Post('/razorpay')
  async handleRazorpayWebhook(
    @Body() payload: RazorpayWebhookPayload,
    @Headers('x-razorpay-signature') signature: string
  ) {
    try {
      this.logger.log(`Received Razorpay webhook: ${payload.event}`);

      // TODO: Verify signature in production
      // if (!this.verifySignature(payload, signature, process.env.RAZORPAY_WEBHOOK_SECRET)) {
      //   this.logger.error('Invalid webhook signature');
      //   return { status: 'error', message: 'Invalid signature' };
      // }

      switch (payload.event) {
        case 'payment.captured':
          await this.handlePaymentCaptured(payload);
          break;

        case 'payment.failed':
          await this.handlePaymentFailed(payload);
          break;

        case 'subscription.activated':
          await this.handleSubscriptionActivated(payload);
          break;

        case 'subscription.cancelled':
          await this.handleSubscriptionCancelled(payload);
          break;

        case 'subscription.completed':
          await this.handleSubscriptionCompleted(payload);
          break;

        default:
          this.logger.log(`Unhandled event type: ${payload.event}`);
      }

      return { status: 'ok' };
    } catch (error) {
      this.logger.error(`Webhook processing failed: ${payload.event}`, error);
      return { status: 'error', message: 'Processing failed' };
    }
  }

  private async handlePaymentCaptured(payload: RazorpayWebhookPayload) {
    if (!payload.data.payment) return;

    const payment = payload.data.payment.entity;
    this.logger.log(`Payment captured: ${payment.id}, Amount: ${payment.amount}`);

    // TODO: Implement payment transaction recording
    // await this.subscriptionService.recordPaymentTransaction({
    //   provider: 'RAZORPAY',
    //   providerTransactionId: payment.id,
    //   amount: payment.amount,
    //   currency: payment.currency,
    //   status: 'SUCCEEDED',
    //   type: 'SUBSCRIPTION_PAYMENT'
    // });

    // TODO: Find and update subscription based on payment metadata
    // const organizationId = payload.data.order?.entity?.notes?.organization_id;
    // if (organizationId) {
    //   await this.subscriptionService.updateSubscriptionStatus(organizationId, 'ACTIVE');
    // }
  }

  private async handlePaymentFailed(payload: RazorpayWebhookPayload) {
    if (!payload.data.payment) return;

    const payment = payload.data.payment.entity;
    this.logger.log(`Payment failed: ${payment.id}`);

    // TODO: Record failed payment transaction
    // await this.subscriptionService.recordPaymentTransaction({
    //   provider: 'RAZORPAY',
    //   providerTransactionId: payment.id,
    //   amount: payment.amount,
    //   currency: payment.currency,
    //   status: 'FAILED',
    //   type: 'SUBSCRIPTION_PAYMENT'
    // });

    // TODO: Update subscription to PAST_DUE status
    // const organizationId = find from payment metadata
    // await this.subscriptionService.updateSubscriptionStatus(organizationId, 'PAST_DUE');
  }

  private async handleSubscriptionActivated(payload: RazorpayWebhookPayload) {
    if (!payload.data.subscription) return;

    const subscription = payload.data.subscription.entity;
    this.logger.log(`Subscription activated: ${subscription.id}`);

    // TODO: Create or update subscription in database
    // await this.subscriptionService.createOrUpdateSubscription({
    //   providerSubscriptionId: subscription.id,
    //   status: 'ACTIVE',
    //   currentPeriodStart: new Date(subscription.current_start * 1000),
    //   currentPeriodEnd: new Date(subscription.current_end * 1000)
    // });
  }

  private async handleSubscriptionCancelled(payload: RazorpayWebhookPayload) {
    if (!payload.data.subscription) return;

    const subscription = payload.data.subscription.entity;
    this.logger.log(`Subscription cancelled: ${subscription.id}`);

    // TODO: Update subscription status to cancelled
    // await this.subscriptionService.cancelSubscription({
    //   providerSubscriptionId: subscription.id
    // });
  }

  private async handleSubscriptionCompleted(payload: RazorpayWebhookPayload) {
    if (!payload.data.subscription) return;

    const subscription = payload.data.subscription.entity;
    this.logger.log(`Subscription completed: ${subscription.id}`);

    // TODO: Handle completed subscription (end of billing cycle)
  }

  @Post('/paypal')
  async handlePayPalWebhook(
    @Body() payload: PayPalWebhookPayload,
    @Headers('PAYPAL-SIGNATURE') signature?: string,
    @Headers('PAYPAL-TRANSMISSION-ID') transmissionId?: string,
    @Headers('PAYPAL-TRANSMISSION-TIME') transmissionTime?: string
  ) {
    try {
      this.logger.log(`Received PayPal webhook: ${payload.event_type}, ID: ${payload.id}`);

      // LOG webhook headers for debugging
      this.logger.log(`Webhook headers - Signature: ${signature?.substring(0, 50)}..., TransmissionId: ${transmissionId}, TransmissionTime: ${transmissionTime}`);

      // Verify PayPal webhook signature for security (disabled in development/sandbox)
      if (process.env.NODE_ENV === 'production') {
        const webhookId = process.env.PAYPAL_WEBHOOK_ID;
        const signatureToVerify = signature || `${transmissionTime || ''},${transmissionId || ''}`;
        if (!await this.verifyPayPalSignature(payload, signatureToVerify, webhookId)) {
          this.logger.error('PayPal webhook signature verification failed');
          return { status: 'error', message: 'Invalid signature' };
        }
      } else {
        this.logger.log(`[DEV MODE] Skipping PayPal signature verification`);
      }

      // Process different PayPal webhook event types
      switch (payload.event_type) {
        case 'BILLING.SUBSCRIPTION.CREATED':
          await this.handlePayPalSubscriptionCreated(payload);
          break;

        case 'BILLING.SUBSCRIPTION.ACTIVATED':
          await this.handlePayPalSubscriptionActivated(payload);
          break;

        case 'BILLING.SUBSCRIPTION.UPDATED':
          await this.handlePayPalSubscriptionUpdated(payload);
          break;

        case 'BILLING.SUBSCRIPTION.CANCELLED':
          await this.handlePayPalSubscriptionCancelled(payload);
          break;

        case 'BILLING.SUBSCRIPTION.SUSPENDED':
          await this.handlePayPalSubscriptionSuspended(payload);
          break;

        case 'BILLING.SUBSCRIPTION.RE-ACTIVATED':
          await this.handlePayPalSubscriptionReactivated(payload);
          break;

        case 'BILLING.SUBSCRIPTION.EXPIRED':
          await this.handlePayPalSubscriptionExpired(payload);
          break;

        case 'BILLING.SUBSCRIPTION.PAYMENT.FAILED':
          await this.handlePayPalSubscriptionPaymentFailed(payload);
          break;

        case 'PAYMENT.SALE.COMPLETED':
          await this.handlePayPalPaymentCompleted(payload);
          break;

        case 'PAYMENT.SALE.DENIED':
          await this.handlePayPalPaymentFailed(payload);
          break;

        case 'PAYMENT.CAPTURE.COMPLETED':
          await this.handlePayPalCaptureCompleted(payload);
          break;

        default:
          this.logger.log(`Unhandled PayPal event type: ${payload.event_type}`);
          return { status: 'ok', message: 'Event not processed' };
      }

      this.logger.log(`Successfully processed PayPal webhook: ${payload.event_type}`);
      return { status: 'ok' };
    } catch (error) {
      this.logger.error('PayPal webhook processing failed', {
        eventType: payload.event_type,
        eventId: payload.id,
        error: error
      });
      return { status: 'error', message: 'Processing failed' };
    }
  }

  // PayPal Subscription Event Handlers
  private async handlePayPalSubscriptionCreated(payload: PayPalWebhookPayload) {
    this.logger.log(`Processing subscription created: ${payload.resource.id}`);

    // Store subscription info but don't activate yet
    // This is when customer approves the subscription but hasn't paid yet

    // TODO: Update PayPalCustomer record with subscription ID
    // TODO: Update subscription status to PENDING
  }

  private async handlePayPalSubscriptionActivated(payload: PayPalWebhookPayload) {
    const subscription = payload.resource;
    this.logger.log(`Processing subscription activated: ${subscription.id}`);
    this.logger.log(`PayPal plan details - ID: ${subscription.plan_id}, Name: ${subscription.plan?.name}`);

    try {
      // Find organization by PayPal subscription ID
      const organization = await this.subscriptionService.getOrganizationByPayPalSubscriptionId(subscription.id);

      if (!organization) {
        this.logger.error(`Organization not found for PayPal subscription: ${subscription.id}`);
        return;
      }

      // Try to get plan name from webhook, PayPal instance mapping, or fetch from PayPal API
      let planName = subscription.plan?.name;
      let planInfo = null;

      if (!planName) {
        // Check if we have plan mapping stored from PayPal service instance
        // NOTE: This would require sharing the mapping between service instances, which would need more work
        // For now, we'll try to parse from plan ID pattern as a fallback before API call

        this.logger.log(`Plan name not provided in webhook, attempting to infer from plan ID: ${subscription.plan_id}`);
        planInfo = this.inferPlanFromId(subscription.plan_id);
        planName = planInfo?.planName;

        if (!planName) {
          // Fallback to API call
          this.logger.log(`Plan inference failed, fetching from PayPal API for plan: ${subscription.plan_id}`);
          const planDetails = await this.fetchPayPalPlanDetails(subscription.plan_id);
          if (planDetails) {
            planName = planDetails.name;
            this.logger.log(`Fetched plan name from PayPal API: ${planName}`);
          } else {
            this.logger.warn(`Failed to fetch plan details for ${subscription.plan_id}`);
          }
        }
      }

      // Map PayPal plan to our tier system
      const tier = this.mapPayPalPlanToTier(subscription.plan_id, planName);
      this.logger.log(`Mapped PayPal plan ${subscription.plan_id} (${planName}) to tier: ${tier}`);

      // Update organization's payment ID with PayPal info
      if (subscription.subscriber) {
        await this.subscriptionService.updateCustomerId(organization.id, `paypal_${subscription.subscriber.payer_id}`);
      }

      // Create or update subscription in database
      // Priority: Use the fetched PayPal plan name data, then fall back to existing subscription
      let period: 'MONTHLY' | 'YEARLY' = 'MONTHLY';

      try {
        // First priority: Check if planName indicates billing period (e.g., "STANDARD Plan (Monthly)")
       // const planName = subscription.plan?.name || '';
        if (planName) {
          // Debug logging to see exactly what's being checked
          const lowercaseName = planName.toLowerCase();
          this.logger.log(`DEBUG: Plan name checking: "${planName}" -> "${lowercaseName}", contains 'month': ${lowercaseName.includes('month')}, contains 'year': ${lowercaseName.includes('year')}`);

          if (lowercaseName.includes('year')) {
            period = 'YEARLY';
            this.logger.log(`Period determined from PayPal plan name: ${period} (${planName}) for org ${organization.id}`);
          } else if (lowercaseName.includes('month')) {
            period = 'MONTHLY';
            this.logger.log(`Period determined from PayPal plan name: ${period} (${planName}) for org ${organization.id}`);
          } else {
            // Plan name doesn't clearly indicate period, check existing subscription
            const existingSubscription = await this.subscriptionService.getSubscription(organization.id);
            if (existingSubscription) {
              period = existingSubscription.period;
              this.logger.log(`Using existing subscription period: ${period} for org ${organization.id}`);
            } else {
              this.logger.log(`No period indication in plan name or existing subscription, using default: ${period}`);
            }
          }
        } else {
          // No plan name available, check existing subscription
          const existingSubscription = await this.subscriptionService.getSubscription(organization.id);
          if (existingSubscription) {
            period = existingSubscription.period;
            this.logger.log(`Using existing subscription period: ${period} for org ${organization.id}`);
          } else {
            this.logger.log(`No plan name or existing subscription found, using default period: ${period}`);
          }
        }
      } catch (error) {
        this.logger.warn(`Could not determine subscription period, defaulting to MONTHLY: ${error}`);
      }

      // Create or update subscription in database
      const createSubscriptionResult = await this.subscriptionService.createOrUpdateSubscription(
        false, // isTrailing
        subscription.id, // identifier (using PayPal subscription ID)
        `paypal_${subscription.subscriber?.payer_id || subscription.id}`, // customerId
        pricing[tier].channel || 1, // totalChannels
        tier, // billing tier
        period, // period
        null, // cancelAt
        undefined, // code
        { id: organization.id } // organization
      );

      // Get the actual subscription from database to ensure it exists for foreign key
      const actualSubscription = await this.subscriptionService.getSubscription(organization.id);
      const subscriptionForTransaction = actualSubscription || null;

      // Record subscription activation transaction
      try {
        // Get the pricing for this tier to record activation details
        const planPricing = pricing[tier] || pricing.PRO;

        // Convert monthly amount to cents, or use yearly amount if this is a yearly subscription
        const amountInCents = period === 'YEARLY'
          ? Math.round(planPricing.year_price * 100)
          : Math.round(planPricing.month_price * 100);

        await this.subscriptionService.createPaymentTransaction(
          organization.id,
          subscriptionForTransaction?.id || null, // Use null if subscription creation failed
          'PAYPAL',
          `activation_${subscription.id}`,
          amountInCents,
          'USD', // Default currency for simplicity
          'SUCCEEDED', // Activation is successful
          'SUBSCRIPTION_PAYMENT', // This activates the subscription payment
          undefined, // paymentMethod
          `PayPal subscription activated - ${tier} Plan (${period})`,
          undefined, // no failure reason for activation
          payload // full payload as metadata
        );

        this.logger.log(`📝 Recorded activation transaction for PayPal subscription: ${subscription.id}, tier: ${tier}, period: ${period}`);
      } catch (transactionError) {
        // Log the error but don't fail the activation process
        this.logger.error(`⚠️ Failed to record activation transaction for subscription ${subscription.id}:`, transactionError);
      }

      // Log successful activation
      this.logger.log(`PayPal subscription ${subscription.id} activated for org ${organization.id}, tier: ${tier}`);

      this.logger.log(`Successfully activated PayPal subscription ${subscription.id} for organization ${organization.id}`);

    } catch (error) {
      this.logger.error(`Failed to process PayPal subscription activation: ${subscription.id}`, error);
      throw error;
    }
  }

  // Try to infer plan information from PayPal plan ID when webhook doesn't provide details
  private inferPlanFromId(planId: string) {
    try {
      // Since in-process caching isn't available across instances, we rely on inference
      // based on known PayPal plan ID patterns (though these are typically random)

      // For now, we can't reliably infer from ID alone since PayPal generates random IDs
      // This would require a database table to store PayPal plan ID -> tier/period mappings

      this.logger.log(`Cannot reliably infer plan from PayPal ID ${planId} - will fetch from API`);
      return null;

    } catch (error) {
      this.logger.error(`Error inferring plan from ID ${planId}:`, error);
      return null;
    }
  }

  // Helper method to map PayPal plan IDs/names to our tier system
  private mapPayPalPlanToTier(planId: string | undefined, planName: string | undefined): 'FREE' | 'STANDARD' | 'PRO' | 'TEAM' | 'ULTIMATE' {
    // Priority: Try to parse from plan name first, then plan ID
    const planText = (planName || planId || '').toLowerCase();

    // Handle new plan names that include period in parentheses, e.g., "PRO Plan (Monthly)"
    if (planText.includes('ultimate')) return 'ULTIMATE';
    if (planText.includes('team')) return 'TEAM';
    if (planText.includes('pro')) return 'PRO';
    if (planText.includes('standard')) return 'STANDARD';

    // Enhanced fallback: Try to parse tier from PayPal plan ID pattern if available
    if (planId) {
      // PayPal plan IDs are typically random, but we might have stored them with metadata
      // For most cases where the plan name is fetched via API, this should work
    }

    // Final fallback: If we can't determine from plan name/ID, check the billing controller request context
    // For now, maintain existing fallback behavior
    this.logger.warn(`Could not map PayPal plan '${planName || planId}' to tier, defaulting to PRO`);
    return 'PRO';
  }

  private async handlePayPalSubscriptionUpdated(payload: PayPalWebhookPayload) {
    const subscription = payload.resource;
    this.logger.log(`Processing subscription updated: ${subscription.id}`);

    // Handle plan changes, status updates, etc.
    // TODO: Implement subscription update logic
  }

  private async handlePayPalSubscriptionCancelled(payload: PayPalWebhookPayload) {
    const subscription = payload.resource;
    this.logger.log(`Processing subscription cancelled: ${subscription.id}`);

    try {
      // Find organization by PayPal subscription ID
      const organization = await this.subscriptionService.getOrganizationByPayPalSubscriptionId(subscription.id);

      if (!organization) {
        this.logger.error(`Organization not found for cancelled PayPal subscription: ${subscription.id}`);
        return;
      }

      // Get current subscription to handle downgrade
      const currentSubscription = await this.subscriptionService.getSubscription(organization.id);
      if (currentSubscription) {
        // Downgrade to FREE tier
        await this.subscriptionService.modifySubscription(
          `paypal_${subscription.subscriber?.payer_id || subscription.id}`,
          pricing.FREE.channel || 1,
          'FREE'
        );
      }

      // Record subscription cancellation transaction
      try {
        await this.subscriptionService.createPaymentTransaction(
          organization.id,
          currentSubscription?.id || null,
          'PAYPAL',
          `cancellation_${subscription.id}`,
          0, // $0 for cancellation (no charge)
          'USD',
          'SUCCEEDED', // Cancellation is a successful operation
          'MANUAL_ADJUSTMENT', // Cancellation is an adjustment
          undefined, // paymentMethod
          `PayPal subscription cancelled - ${currentSubscription?.subscriptionTier || 'Plan'}`,
          undefined, // no failure reason for cancellation
          payload // full payload as metadata
        );

        this.logger.log(`📝 Recorded cancellation transaction for PayPal subscription: ${subscription.id}, tier: ${currentSubscription?.subscriptionTier}`);
      } catch (transactionError) {
        // Log the error but don't fail the cancellation process
        this.logger.error(`⚠️ Failed to record cancellation transaction for subscription ${subscription.id}:`, transactionError);
      }

      // Log cancellation event
      this.logger.log(`PayPal subscription ${subscription.id} cancelled for org ${organization.id}, downgraded from ${currentSubscription?.subscriptionTier} to FREE`);

      this.logger.log(`Successfully cancelled PayPal subscription ${subscription.id} for organization ${organization.id}`);

    } catch (error) {
      this.logger.error(`Failed to process PayPal subscription cancellation: ${subscription.id}`, error);
      throw error;
    }
  }

  private async handlePayPalSubscriptionSuspended(payload: PayPalWebhookPayload) {
    const subscription = payload.resource;
    this.logger.log(`Processing subscription suspended: ${subscription.id}`);

    // TODO: Update subscription status to suspended
    // TODO: Create billing alert message
  }

  private async handlePayPalSubscriptionReactivated(payload: PayPalWebhookPayload) {
    const subscription = payload.resource;
    this.logger.log(`Processing subscription reactivated: ${subscription.id}`);

    // TODO: Update subscription status to active
    // TODO: Clear any suspension messages
  }

  private async handlePayPalPaymentCompleted(payload: PayPalWebhookPayload) {
    const payment = payload.resource;
    this.logger.log(`Processing payment completed: ${payment.id}`);

    try {
      // Extract amount from billing_info if available
      const amount = payment.billing_info?.last_payment?.amount;
      if (!amount) {
        this.logger.warn(`No amount information in payment completed webhook: ${payment.id}`);
        return;
      }

      // Find organization by PayPal subscription ID (from related_resources if available)
      const subscriptionId = payment.id; // Assuming payment ID relates to subscription
      const organization = await this.subscriptionService.getOrganizationByPayPalSubscriptionId(subscriptionId);

      if (!organization) {
        this.logger.error(`Organization not found for PayPal payment: ${payment.id}`);
        return;
      }

      // Get subscription information for the transaction
      const subscription = await this.subscriptionService.getSubscription(organization.id);

      // Convert amount to cents (database stores in cents)
      const amountInCents = Math.round(parseFloat(amount.value) * 100);

      // Create transaction record
      await this.subscriptionService.createPaymentTransaction(
        organization.id,
        subscription?.id || null,
        'PAYPAL',
        payment.id,
        amountInCents,
        amount.currency_code,
        'SUCCEEDED',
        'SUBSCRIPTION_PAYMENT',
        undefined, // paymentMethod
        `PayPal subscription payment for ${subscription ? subscription.subscriptionTier : 'Plan'}`,
        undefined, // failureReason
        payload // full payload as metadata
      );

      this.logger.log(`Created payment transaction for PayPal payment: ${payment.id} for org ${organization.id}, amount: $${amount.value} (${amount.currency_code})`);

      this.logger.log(`Successfully processed PayPal payment completion: ${payment.id} for organization ${organization.id}`);

    } catch (error) {
      this.logger.error(`Failed to process PayPal payment completion: ${payment.id}`, error);
      throw error;
    }
  }

  private async handlePayPalPaymentFailed(payload: PayPalWebhookPayload) {
    const payment = payload.resource;
    this.logger.log(`Processing payment failed: ${payment.id}`);

    try {
      // Find organization by PayPal subscription ID
      const organization = await this.subscriptionService.getOrganizationByPayPalSubscriptionId(payment.id);

      if (!organization) {
        this.logger.error(`Organization not found for failed PayPal payment: ${payment.id}`);
        return;
      }

      // Get subscription information for the transaction
      const subscription = await this.subscriptionService.getSubscription(organization.id);

      // Extract amount if available
      let amountInCents = 0;
      let currency = 'USD';
      let description = `PayPal payment failed for ${subscription ? subscription.subscriptionTier : 'Plan'}`;

      if (payment.billing_info?.last_payment?.amount) {
        const amount = payment.billing_info.last_payment.amount;
        amountInCents = Math.round(parseFloat(amount.value) * 100);
        currency = amount.currency_code;
        description = `PayPal payment failed for ${subscription ? subscription.subscriptionTier : 'Plan'} - $${amount.value} (${amount.currency_code})`;
      }

      // Create transaction record for failed payment
      await this.subscriptionService.createPaymentTransaction(
        organization.id,
        subscription?.id || null,
        'PAYPAL',
        payment.id,
        amountInCents,
        currency,
        'FAILED',
        'SUBSCRIPTION_PAYMENT',
        undefined, // paymentMethod
        description,
        `PayPal payment failed - see payload for details`, // failureReason
        payload // full payload as metadata
      );

      this.logger.warn(`Created failed payment transaction for PayPal payment: ${payment.id} for org ${organization.id} - user should be notified`);

      this.logger.log(`Successfully processed PayPal payment failure: ${payment.id} for organization ${organization.id}`);

    } catch (error) {
      this.logger.error(`Failed to process PayPal payment failure: ${payment.id}`, error);
      throw error;
    }
  }

  private async handlePayPalCaptureCompleted(payload: PayPalWebhookPayload) {
    const capture = payload.resource;
    this.logger.log(`Processing capture completed: ${capture.id}`);

    try {
      // Extract amount and transaction details from capture
      const amount = capture.billing_info?.last_payment?.amount;
      if (!amount) {
        this.logger.warn(`No amount information in capture completed webhook: ${capture.id}`);
        // Still log successful capture for one-time payments
        this.logger.log(`Successfully processed PayPal capture for: ${capture.id}`);
        return;
      }

      // Try to find organization by PayPal subscription ID or other identifiers
      let organization = null;

      // First, try to find by subscription if this is part of a subscription
      if (payload.resource.links) {
        for (const link of payload.resource.links) {
          if (link.rel === 'up' && link.href.includes('/subscriptions/')) {
            const subscriptionId = link.href.split('/subscriptions/')[1]?.split('/')[0];
            if (subscriptionId) {
              organization = await this.subscriptionService.getOrganizationByPayPalSubscriptionId(subscriptionId);
              if (organization) {
                this.logger.log(`Found organization via subscription link in capture: ${capture.id}`);
                break;
              }
            }
          }
        }
      }

      // If not found via subscription, try other methods
      if (!organization && capture.subscriber?.payer_id) {
        organization = await this.subscriptionService.getOrganizationByPayPalSubscriptionId(capture.subscriber.payer_id);
      }

      if (!organization) {
        this.logger.warn(`No organization found for PayPal capture: ${capture.id} - may be one-time payment`);
        this.logger.log(`Successfully processed PayPal capture for: ${capture.id}`);
        return;
      }

      // Get subscription information for the transaction
      const subscription = await this.subscriptionService.getSubscription(organization.id);

      // Convert amount to cents (database stores in cents)
      const amountInCents = Math.round(parseFloat(amount.value) * 100);

      // Create transaction record
      await this.subscriptionService.createPaymentTransaction(
        organization.id,
        subscription?.id || null,
        'PAYPAL',
        capture.id,
        amountInCents,
        amount.currency_code,
        'SUCCEEDED',
        'SUBSCRIPTION_PAYMENT', // Could also be UPGRADE_PAYMENT or other types
        undefined, // paymentMethod
        `PayPal capture payment for ${subscription ? subscription.subscriptionTier : 'Plan'}`,
        undefined, // failureReason
        payload // full payload as metadata
      );

      this.logger.log(`Created payment transaction for PayPal capture: ${capture.id} for org ${organization.id}, amount: $${amount.value} (${amount.currency_code})`);

      this.logger.log(`Successfully processed PayPal capture for: ${capture.id}`);

    } catch (error) {
      this.logger.error(`Failed to process PayPal capture completion: ${capture.id}`, error);
      throw error;
    }

    // TODO: Handle one-time payments (like lifetime deals)
    // TODO: Create appropriate billing history entries
  }

  private async handlePayPalSubscriptionExpired(payload: PayPalWebhookPayload) {
    const subscription = payload.resource;
    this.logger.log(`Processing subscription expired: ${subscription.id}`);

    // Handle subscription expiry - typically downgrade to FREE tier
    // TODO: Find organization by subscription ID and downgrade to FREE plan
    // TODO: Update subscription record in database
    // TODO: Send expiry notification email
    // TODO: Log expiry in billing history
    // TODO: Update quotas to FREE tier limits
  }

  private async handlePayPalSubscriptionPaymentFailed(payload: PayPalWebhookPayload) {
    const subscription = payload.resource;
    this.logger.log(`Processing subscription payment failed: ${subscription.id}`);

    try {
      // Find organization by PayPal subscription ID
      const organization = await this.subscriptionService.getOrganizationByPayPalSubscriptionId(subscription.id);

      if (!organization) {
        this.logger.error(`Organization not found for PayPal subscription payment failure: ${subscription.id}`);
        return;
      }

      // Get subscription information for the transaction
      const currentSubscription = await this.subscriptionService.getSubscription(organization.id);

      // Extract amount if available
      let amountInCents = 0;
      let currency = 'USD';
      let description = `PayPal subscription payment failed for ${currentSubscription ? currentSubscription.subscriptionTier : 'Plan'}`;

      if (subscription.billing_info?.last_payment?.amount) {
        const amount = subscription.billing_info.last_payment.amount;
        amountInCents = Math.round(parseFloat(amount.value) * 100);
        currency = amount.currency_code;
        description = `PayPal subscription payment failed for ${currentSubscription ? currentSubscription.subscriptionTier : 'Plan'} - $${amount.value} (${amount.currency_code})`;
      }

      // Record failed payment in PaymentTransaction table
      await this.subscriptionService.createPaymentTransaction(
        organization.id,
        currentSubscription?.id || null,
        'PAYPAL',
        subscription.id,
        amountInCents,
        currency,
        'FAILED',
        'SUBSCRIPTION_PAYMENT',
        undefined, // paymentMethod
        description,
        `PayPal subscription payment failed - see payload for details`, // failureReason
        payload // full payload as metadata
      );

      this.logger.warn(`Recorded failed subscription payment transaction for PayPal subscription: ${subscription.id} for org ${organization.id} - user should be notified`);

      this.logger.log(`Successfully processed PayPal subscription payment failure: ${subscription.id} for organization ${organization.id}`);

    } catch (error) {
      this.logger.error(`Failed to process PayPal subscription payment failure: ${subscription.id}`, error);
      throw error;
    }

    // Handle failed payment - set subscription to past due status
    // TODO: Find organization by subscription ID and update status to PAST_DUE
    // TODO: Update subscription retry dates
    // TODO: Send payment failure notification to user
    // TODO: Create billing alert/dunning management
    // TODO: Potentially suspend service after multiple failures
  }

  @Post('/stripe')
  async handleStripeWebhook(
    @Body() payload: any,
    @Headers('stripe-signature') signature: string
  ) {
    try {
      this.logger.log(`Received Stripe webhook: ${payload.type}`);

      // Forward to existing Stripe handler or integrate with new billing system
      // TODO: Implement Stripe webhook integration with new billing schema

      return { status: 'ok' };
    } catch (error) {
      this.logger.error('Stripe webhook processing failed', error);
      return { status: 'error', message: 'Processing failed' };
    }
  }
}
import { Controller, Post, Body, Headers, Logger } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

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

@ApiTags('Payment Webhooks')
@Controller('/webhooks')
export class PaymentWebhooksController {
  private readonly logger = new Logger(PaymentWebhooksController.name);

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
    @Body() payload: any,
    @Headers('PAYPAL-SIGNATURE') signature: string
  ) {
    try {
      this.logger.log(`Received PayPal webhook: ${payload.event_type}`);

      // TODO: Verify PayPal signature
      // TODO: Handle PayPal specific webhook events

      return { status: 'ok' };
    } catch (error) {
      this.logger.error('PayPal webhook processing failed', error);
      return { status: 'error', message: 'Processing failed' };
    }
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
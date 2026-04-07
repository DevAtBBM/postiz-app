import { Module, Global } from '@nestjs/common';
import { QuotaGuard } from './quota.guard';
import { UsageTrackingMiddleware } from './usage.middleware';
import { SubscriptionService } from './subscription.service';
import { PayPalService } from '../../../services/paypal.service';
import { PayPalBillingService } from '../../../services/paypal-billing.service';
import { RazorpayService } from '../../../services/razorpay.service';
import { PaymentWebhooksController } from '../../../../services/payment-webhooks.controller';

@Global()
@Module({
  providers: [
    SubscriptionService,
    QuotaGuard,
    UsageTrackingMiddleware,
    PayPalService,
    PayPalBillingService,
    RazorpayService,
    PaymentWebhooksController
  ],
  exports: [
    SubscriptionService,
    QuotaGuard,
    UsageTrackingMiddleware,
    PayPalService,
    PayPalBillingService,
    RazorpayService,
    PaymentWebhooksController
  ],
  controllers: [PaymentWebhooksController],
})
export class BillingModule {}
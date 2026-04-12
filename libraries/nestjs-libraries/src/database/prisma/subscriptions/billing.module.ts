import { Module, Global } from '@nestjs/common';
import { QuotaGuard } from './quota.guard';
import { UsageTrackingMiddleware } from './usage.middleware';
import { PayPalService } from '../../../services/paypal.service';
import { PayPalBillingService } from '../../../services/paypal-billing.service';
import { RazorpayService } from '../../../services/razorpay.service';
import { PaymentWebhooksController } from '@gitroom/nestjs-libraries/services/payment-webhooks.controller';

@Global()
@Module({
  providers: [
    QuotaGuard,
    UsageTrackingMiddleware,
    PayPalService,
    PayPalBillingService,
    RazorpayService,
    PaymentWebhooksController
  ],
  exports: [
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
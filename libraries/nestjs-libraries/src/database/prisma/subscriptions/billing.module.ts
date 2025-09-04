import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { QuotaGuard } from './quota.guard';
import { UsageTrackingMiddleware } from './usage.middleware';
import { SubscriptionService } from './subscription.service';
import { PayPalService } from '../../../services/paypal.service';
import { PayPalBillingService } from '../../../services/paypal-billing.service';
import { PaymentWebhooksController } from '../../../../services/payment-webhooks.controller';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    SubscriptionService,
    QuotaGuard,
    UsageTrackingMiddleware,
    PayPalService,
    PayPalBillingService,
    PaymentWebhooksController
  ],
  exports: [
    SubscriptionService,
    QuotaGuard,
    UsageTrackingMiddleware,
    PayPalService,
    PayPalBillingService,
    PaymentWebhooksController
  ],
  controllers: [PaymentWebhooksController],
})
export class BillingModule {}
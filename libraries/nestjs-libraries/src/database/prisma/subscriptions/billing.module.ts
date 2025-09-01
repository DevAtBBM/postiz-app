import { Module, Global } from '@nestjs/common';
import { QuotaGuard } from './quota.guard';
import { UsageTrackingMiddleware } from './usage.middleware';
import { SubscriptionService } from './subscription.service';

@Global()
@Module({
  providers: [SubscriptionService, QuotaGuard, UsageTrackingMiddleware],
  exports: [SubscriptionService, QuotaGuard, UsageTrackingMiddleware],
})
export class BillingModule {}
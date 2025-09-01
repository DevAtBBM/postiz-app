import { Injectable, NestMiddleware } from '@nestjs/common';
import { Response, NextFunction } from 'express';
import { SubscriptionRepository } from './subscription.repository';
import { Organization } from '@prisma/client';

interface UsageTrackedRequest extends Request {
  organization: Organization;
  user: any;
  originalUrl?: string;
}

@Injectable()
export class UsageTrackingMiddleware implements NestMiddleware {
  constructor(private readonly subscriptionRepository: SubscriptionRepository) {}

  async use(req: UsageTrackedRequest, res: Response, next: NextFunction) {
    const originalUrl = req.originalUrl || req.url;
    const path = originalUrl;

    // Track before response is sent
    res.on('finish', async () => {
      if (res.statusCode < 400) { // Only track successful requests
        await this.trackUsage(req, path);
      }
    });

    next();
  }

  private async trackUsage(req: UsageTrackedRequest, path: string) {
    try {
      const organization = req.organization;
      if (!organization) return;

      // Determine usage type from URL/endpoint
      let usageType = this.determineUsageType(path);

      if (!usageType) return;

      // For now, we'll track usage as credits (existing system)
      // Later this can be extended to use the new UsageRecord model
      const subscription = await this.subscriptionRepository.getSubscription(organization.id);

      if (!subscription) return;

      // Map usage types to credit types
      const creditTypeMap = {
        posts: 'posts',
        ai_images: 'ai_images',
        ai_videos: 'ai_videos', // If we add this later
      };

      const creditType = creditTypeMap[usageType];
      if (creditType) {
        // Use the existing credit tracking system
        // Note: This would need the user context, for now it's basic tracking
        await this.trackUsageAsCredit(organization, creditType);
      }
    } catch (error) {
      // Log error but don't fail the request
      console.error('Usage tracking error:', error);
    }
  }

  private determineUsageType(path: string): string | null {
    // List of patterns and their corresponding usage types
    const patterns = [
      {
        regex: /(\/post|\/publish)/i,
        type: 'posts'
      },
      {
        regex: /(\/ai.*\/image|\/image.*\/generate)/i,
        type: 'ai_images'
      },
      {
        regex: /(\/ai.*\/video|\/video.*\/generate)/i,
        type: 'ai_videos'
      }
    ];

    for (const pattern of patterns) {
      if (pattern.regex.test(path)) {
        return pattern.type;
      }
    }

    return null;
  }

  private async trackUsageAsCredit(organization: Organization, creditType: string) {
    // This is a simplified version - in production you'd want proper user context
    // For now, we'll just log the usage
    console.log(`Usage tracked - Organization: ${organization.id}, Type: ${creditType}`);

    // When we have the new schema working, this would create a UsageRecord instead
    // await this.subscriptionRepository.trackUsage(
    //   subscriptionId,
    //   usageType as any,
    //   1,
    //   startOfPeriod,
    //   endOfPeriod,
    //   undefined,
    //   'api_call'
    // );
  }
}

/**
 * Usage tracking utilities for the billing system
 */
export class UsageTracker {
  constructor(private readonly subscriptionRepository: SubscriptionRepository) {}

  /**
   * Track a feature usage event
   */
  async trackFeatureUsage(
    organizationId: string,
    feature: 'posts' | 'ai_images' | 'ai_videos' | 'integrations',
    amount = 1,
    context?: any
  ) {
    const subscription = await this.subscriptionRepository.getSubscription(organizationId);
    if (!subscription) throw new Error('No subscription found');

    console.log(`Feature usage tracked: ${feature} (${amount}) for organization ${organizationId}`);

    // TODO: Implement with new UsageRecord schema when ready
    // await this.subscriptionRepository.trackUsage(
    //   subscription.id,
    //   feature.toUpperCase() as any,
    //   amount,
    //   startOfMonth,
    //   endOfMonth,
    //   undefined,
    //   'feature_usage',
    //   context
    // );
  }

  /**
   * Get usage summary for an organization
   */
  async getUsageSummary(organizationId: string, periodStart?: Date, periodEnd?: Date) {
    const subscription = await this.subscriptionRepository.getSubscription(organizationId);
    if (!subscription) throw new Error('No subscription found');

    if (!periodStart || !periodEnd) {
      const now = new Date();
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }

    // For now, return mock data since new schema isn't available
    return {
      period: {
        start: periodStart,
        end: periodEnd,
      },
      usage: {
        posts: 0, // Would query UsageRecord when available
        ai_images: 0,
        ai_videos: 0,
        integrations: 0,
      },
      limits: {
        posts: 100, // Would get from plan
        ai_images: 20,
        ai_videos: 0,
      }
    };
  }

  /**
   * Check if organization has exceeded usage limits
   */
  async hasExceededLimits(organizationId: string, feature: string) {
    // This would check the usage against plan limits
    // For now, return false since we're not enforcing limits yet
    return false;
  }
}
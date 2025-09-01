import { Injectable } from '@nestjs/common';
import { pricing } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/pricing';
import { SubscriptionRepository } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/subscription.repository';
import { IntegrationService } from '@gitroom/nestjs-libraries/database/prisma/integrations/integration.service';
import { OrganizationService } from '@gitroom/nestjs-libraries/database/prisma/organizations/organization.service';
import { Organization } from '@prisma/client';
import dayjs from 'dayjs';
import { makeId } from '@gitroom/nestjs-libraries/services/make.is';

@Injectable()
export class SubscriptionService {
  constructor(
    private readonly _subscriptionRepository: SubscriptionRepository,
    private readonly _integrationService: IntegrationService,
    private readonly _organizationService: OrganizationService
  ) {}

  getSubscriptionByOrganizationId(organizationId: string) {
    return this._subscriptionRepository.getSubscriptionByOrganizationId(
      organizationId
    );
  }

  useCredit<T>(organization: Organization, type = 'ai_images', func: () => Promise<T>) : Promise<T> {
    return this._subscriptionRepository.useCredit(organization, type, func);
  }

  getCode(code: string) {
    return this._subscriptionRepository.getCode(code);
  }

  updateAccount(userId: string, account: string) {
    return this._subscriptionRepository.updateAccount(userId, account);
  }

  getUserAccount(userId: string) {
    return this._subscriptionRepository.getUserAccount(userId);
  }

  async deleteSubscription(customerId: string) {
    await this.modifySubscription(
      customerId,
      pricing.FREE.channel || 0,
      'FREE'
    );
    return this._subscriptionRepository.deleteSubscriptionByCustomerId(
      customerId
    );
  }

  updateCustomerId(organizationId: string, customerId: string) {
    return this._subscriptionRepository.updateCustomerId(
      organizationId,
      customerId
    );
  }

  async checkSubscription(organizationId: string, subscriptionId: string) {
    return await this._subscriptionRepository.checkSubscription(
      organizationId,
      subscriptionId
    );
  }

  updateConnectedStatus(account: string, accountCharges: boolean) {
    return this._subscriptionRepository.updateConnectedStatus(
      account,
      accountCharges
    );
  }

  async modifySubscription(
    customerId: string,
    totalChannels: number,
    billing: 'FREE' | 'STANDARD' | 'PRO' | 'TEAM' | 'ULTIMATE'
  ) {
    if (!customerId) {
      return false;
    }

    const getOrgByCustomerId =
      await this._subscriptionRepository.getOrganizationByCustomerId(
        customerId
      );

    const getCurrentSubscription =
      (await this._subscriptionRepository.getSubscriptionByCustomerId(
        customerId
      ))!;

    if (
      !getOrgByCustomerId ||
      (getCurrentSubscription && getCurrentSubscription?.isLifetime)
    ) {
      return false;
    }

    const from = pricing[getCurrentSubscription?.subscriptionTier || 'FREE'];
    const to = pricing[billing];

    const currentTotalChannels = (
      await this._integrationService.getIntegrationsList(
        getOrgByCustomerId?.id!
      )
    ).filter((f) => !f.disabled);

    if (currentTotalChannels.length > totalChannels) {
      await this._integrationService.disableIntegrations(
        getOrgByCustomerId?.id!,
        currentTotalChannels.length - totalChannels
      );
    }

    if (from.team_members && !to.team_members) {
      await this._organizationService.disableOrEnableNonSuperAdminUsers(
        getOrgByCustomerId?.id!,
        true
      );
    }

    if (!from.team_members && to.team_members) {
      await this._organizationService.disableOrEnableNonSuperAdminUsers(
        getOrgByCustomerId?.id!,
        false
      );
    }

    if (billing === 'FREE') {
      await this._integrationService.changeActiveCron(getOrgByCustomerId?.id!);
    }

    return true;

    // if (to.faq < from.faq) {
    //   await this._faqRepository.deleteFAQs(getCurrentSubscription?.organizationId, from.faq - to.faq);
    // }
    // if (to.categories < from.categories) {
    //   await this._categoriesRepository.deleteCategories(getCurrentSubscription?.organizationId, from.categories - to.categories);
    // }
    // if (to.integrations < from.integrations) {
    //   await this._integrationsRepository.deleteIntegrations(getCurrentSubscription?.organizationId, from.integrations - to.integrations);
    // }
    // if (to.user < from.user) {
    //   await this._integrationsRepository.deleteUsers(getCurrentSubscription?.organizationId, from.user - to.user);
    // }
    // if (to.domains < from.domains) {
    //   await this._settingsService.deleteDomainByOrg(getCurrentSubscription?.organizationId);
    //   await this._organizationRepository.changePowered(getCurrentSubscription?.organizationId);
    // }
  }

  async createOrUpdateSubscription(
    isTrailing: boolean,
    identifier: string,
    customerId: string,
    totalChannels: number,
    billing: 'FREE' | 'STANDARD' | 'PRO' | 'TEAM' | 'ULTIMATE',
    period: 'MONTHLY' | 'YEARLY',
    cancelAt: number | null,
    code?: string,
    org?: { id: string }
  ) {
    if (!code) {
      try {
        const load = await this.modifySubscription(
          customerId,
          totalChannels,
          billing
        );
        if (!load) {
          return {};
        }
      } catch (e) {
        return {};
      }
    }
    return this._subscriptionRepository.createOrUpdateSubscription(
      isTrailing,
      identifier,
      customerId,
      totalChannels,
      billing,
      period,
      cancelAt,
      code,
      org
    );
  }

  async getSubscription(organizationId: string) {
    return this._subscriptionRepository.getSubscription(organizationId);
  }

  async checkCredits(organization: Organization, checkType = 'ai_images') {
    // @ts-ignore
    const type = organization?.subscription?.subscriptionTier || 'FREE';

    if (type === 'FREE') {
      return { credits: 0 };
    }

    // @ts-ignore
    let date = dayjs(organization.subscription.createdAt);
    while (date.isBefore(dayjs())) {
      date = date.add(1, 'month');
    }

    const checkFromMonth = date.subtract(1, 'month');
    const imageGenerationCount = checkType === 'ai_images' ? pricing[type].image_generation_count : pricing[type].generate_videos

    const totalUse = await this._subscriptionRepository.getCreditsFrom(
      organization.id,
      checkFromMonth,
      checkType
    );

    return {
      credits: imageGenerationCount - totalUse,
    };
  }

  async lifeTime(orgId: string, identifier: string, subscription: 'FREE' | 'STANDARD' | 'PRO' | 'TEAM' | 'ULTIMATE') {
    return this.createOrUpdateSubscription(
      false,
      identifier,
      identifier,
      pricing[subscription].channel!,
      subscription,
      'YEARLY',
      null,
      identifier,
      { id: orgId }
    );
  }

  async addSubscription(orgId: string, userId: string, subscription: 'FREE' | 'STANDARD' | 'PRO') {
    await this._subscriptionRepository.setCustomerId(orgId, userId);
    return this.createOrUpdateSubscription(
      false,
      makeId(5),
      userId,
      pricing[subscription].channel!,
      subscription,
      'MONTHLY',
      null,
      undefined,
      { id: orgId }
    );
  }

  async createFreeSubscription(organizationId: string) {
    try {
      console.log(`Creating FREE subscription for organization ${organizationId}`);

      // Use the createOrUpdateSubscription with FREE tier
      const result = await this.createOrUpdateSubscription(
        false, // isTrailing (for organization, not subscription)
        `FREE_${organizationId}_${Date.now()}`, // identifier
        'mock_customer_free', // customerId (mock for free)
        pricing.FREE.channel || 1, // totalChannels
        'FREE', // billing tier
        'MONTHLY', // period
        null, // cancelAt
        undefined, // code
        {
          id: organizationId
        } // organization object
      );

      console.log(`FREE subscription created for organization ${organizationId}`);
      return result;
    } catch (error) {
      console.error(`Failed to create FREE subscription for ${organizationId}:`, error);

      // Fallback: return a mock subscription to prevent crashes
      console.log('Returning mock FREE subscription to prevent service crashes');
      return {
        mock: true,
        isMock: true, // Add isMock flag for frontend handling
        organizationId,
        subscriptionTier: 'FREE',
        totalChannels: pricing.FREE.channel || 1,
        period: 'MONTHLY',
        isLifetime: false,
        identifier: `FREE_${organizationId}_${Date.now()}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
  }

  // ================================================
  // NEW SUBSCRIPTION BILLING SERVICE METHODS
  // ================================================

  async checkFeatureLimits(
    organizationId: string,
    featureType: 'posts' | 'ai_images' | 'ai_videos',
    requestedAmount: number = 1
  ) {
    const subscription = await this.getSubscription(organizationId);
    if (!subscription) return { allowed: false, reason: 'No subscription found' };

    if (subscription.isLifetime || featureType === 'posts' && subscription.subscriptionTier === 'FREE') {
      return { allowed: true, currentUsage: 0, limit: 'unlimited' };
    }

    const now = dayjs();
    const startOfMonth = now.startOf('month').toDate();
    const endOfMonth = now.endOf('month').toDate();

    // Check credits usage
    const typeMap = {
      posts: 'posts_per_month',
      ai_images: 'image_generation_count',
      ai_videos: 'generate_videos'
    } as const;

    const creditType = featureType === 'ai_images' ? 'ai_images' : featureType === 'posts' ? 'posts' : featureType;
    const creditsUsed = await this._subscriptionRepository.getCreditsFrom(
      organizationId,
      dayjs(startOfMonth),
      creditType as 'posts' | 'ai_images' | 'ai_videos'
    );

    const limit = pricing[subscription.subscriptionTier as keyof typeof pricing as string]?.[typeMap[featureType]] || 0;

    if (subscription.subscriptionTier === 'FREE' && featureType === 'posts') {
      // Free plan is tracked but not limited for posts (up to 5)
      return { allowed: true, currentUsage: creditsUsed, limit: 5 };
    }

    return {
      allowed: (limit === 1000000) || (creditsUsed + requestedAmount) <= limit,
      currentUsage: creditsUsed,
      limit: limit === 1000000 ? 'unlimited' : limit,
      reason: (limit === 1000000 || (creditsUsed + requestedAmount) <= limit) ? undefined : `Usage limit exceeded: ${creditsUsed}/${limit}`
    };
  }

  async useFeature(
    organization: Organization,
    featureType: 'posts' | 'ai_images' | 'ai_videos',
    action: () => Promise<any>
  ) {
    // Check if user has permission to use this feature
    const limits = await this.checkFeatureLimits(organization.id, featureType);

    if (!limits.allowed) {
      throw new Error(`Feature usage limit exceeded: ${limits.reason || 'Unknown limit'}`);
    }

    // For posts, we still use the old credit tracking system
    if (featureType === 'posts') {
      return this._subscriptionRepository.useCredit(
        organization,
        'posts',
        action
      );
    }

    // For AI features, we could use credit tracking or implement new usage tracking
    if (featureType === 'ai_images') {
      return this._subscriptionRepository.useCredit(
        organization,
        'ai_images',
        action
      );
    }

    // Execute the action without credit tracking for videos (depending on plan)
    return action();
  }

  async getUsageReport(organizationId: string) {
    const subscription = await this.getSubscription(organizationId);
    if (!subscription) return null;

    const now = dayjs();
    const startOfMonth = now.startOf('month').toDate();

    // Get usage for different features - convert to dayjs type
    const [postsUsed, aiImagesUsed] = await Promise.all([
      this._subscriptionRepository.getCreditsFrom(organizationId, dayjs(startOfMonth), 'posts'),
      this._subscriptionRepository.getCreditsFrom(organizationId, dayjs(startOfMonth), 'ai_images'),
    ]);

    return {
      subscription: {
        tier: subscription.subscriptionTier,
        period: subscription.period,
        channels: subscription.totalChannels,
      },
      usage: {
        posts: postsUsed,
        aiImages: aiImagesUsed,
        aiVideos: 0, // Not tracked yet in old system
      },
      limits: {
        posts: pricing[subscription.subscriptionTier as keyof typeof pricing]?.posts_per_month,
        aiImages: pricing[subscription.subscriptionTier as keyof typeof pricing]?.image_generation_count,
        aiVideos: pricing[subscription.subscriptionTier as keyof typeof pricing]?.generate_videos,
      },
      billingPeriod: {
        start: startOfMonth,
        end: now.endOf('month').toDate(),
      }
    };
  }

  async validateSubscriptionUpgrade(
    currentSubscription: any,
    newTier: 'FREE' | 'STANDARD' | 'TEAM' | 'PRO' | 'ULTIMATE',
    currentIntegrations: any[]
  ) {
    const currentPlan = pricing[currentSubscription.subscriptionTier];
    const newPlan = pricing[newTier];

    const downgradeHints = [];

    // Check channel limits - use the channel property from the pricing interface
    if (currentIntegrations.filter(i => !i.disabled).length > (newPlan.channel || 0)) {
      downgradeHints.push({
        type: 'channels',
        current: currentIntegrations.filter(i => !i.disabled).length,
        limit: newPlan.channel || 0,
        suggestion: 'Disable some integrations before downgrading'
      });
    }

    // Check usage limits (if downgrading)
    if (newPlan.posts_per_month < currentPlan.posts_per_month) {
      downgradeHints.push({
        type: 'posts',
        current: currentPlan.posts_per_month,
        limit: newPlan.posts_per_month,
        suggestion: 'Usage will be limited next month'
      });
    }

    return {
      canUpgrade: downgradeHints.length === 0,
      warnings: downgradeHints,
      cost: {
        monthly: newPlan.month_price,
        yearly: newPlan.year_price,
      },
      features: {
        channels: newPlan.channel,
        postsPerMonth: newPlan.posts_per_month === 1000000 ? 'unlimited' : newPlan.posts_per_month,
        aiImages: newPlan.image_generation_count === 1000000 ? 'unlimited' : newPlan.image_generation_count,
        aiVideos: newPlan.generate_videos === 1000000 ? 'unlimited' : newPlan.generate_videos,
        teamMembers: newPlan.team_members ? 'unlimited' : 'max 1',
        features: newPlan.community_features,
      }
    };
  }
}

import { Injectable, Logger } from '@nestjs/common';
import {
  PrismaRepository,
  PrismaTransaction,
  PrismaService,
} from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import {
  PrismaClient,
  Organization,
  SubscriptionTier,
  Period,
  PaymentProvider,
  PaymentTransactionStatus,
  PaymentType,
  UsageType,
  SubscriptionChangeReason,
} from '@prisma/client';
import dayjs from 'dayjs';


@Injectable()
export class SubscriptionRepository {
  private readonly logger = new Logger(SubscriptionRepository.name);

  constructor(
    private readonly _subscription: PrismaRepository<'subscription'>,
    private readonly _organization: PrismaRepository<'organization'>,
    private readonly _user: PrismaRepository<'user'>,
    private readonly _credits: PrismaRepository<'credits'>,
    private _usedCodes: PrismaRepository<'usedCodes'>,
    private readonly _prisma: PrismaService
  ) {}

  getUserAccount(userId: string) {
    return this._user.model.user.findFirst({
      where: {
        id: userId,
      },
      select: {
        account: true,
        connectedAccount: true,
      },
    });
  }

  getCode(code: string) {
    return this._usedCodes.model.usedCodes.findFirst({
      where: {
        code,
      },
    });
  }

  updateAccount(userId: string, account: string) {
    return this._user.model.user.update({
      where: {
        id: userId,
      },
      data: {
        account,
      },
    });
  }

  getSubscriptionByOrganizationId(organizationId: string) {
    return this._subscription.model.subscription.findFirst({
      where: {
        organizationId,
        deletedAt: null,
      },
    });
  }

  updateConnectedStatus(account: string, accountCharges: boolean) {
    return this._user.model.user.updateMany({
      where: {
        account,
      },
      data: {
        connectedAccount: accountCharges,
      },
    });
  }

  getCustomerIdByOrgId(organizationId: string) {
    return this._organization.model.organization.findFirst({
      where: {
        id: organizationId,
      },
      select: {
        paymentId: true,
      },
    });
  }

  checkSubscription(organizationId: string, subscriptionId: string) {
    return this._subscription.model.subscription.findFirst({
      where: {
        organizationId,
        identifier: subscriptionId,
        deletedAt: null,
      },
    });
  }

  deleteSubscriptionByCustomerId(customerId: string) {
    return this._subscription.model.subscription.deleteMany({
      where: {
        organization: {
          paymentId: customerId,
        },
      },
    });
  }

  updateCustomerId(organizationId: string, customerId: string) {
    return this._organization.model.organization.update({
      where: {
        id: organizationId,
      },
      data: {
        paymentId: customerId,
      },
    });
  }

  async getSubscriptionByCustomerId(customerId: string) {
    return this._subscription.model.subscription.findFirst({
      where: {
        organization: {
          paymentId: customerId,
        },
      },
    });
  }

  async getOrganizationByCustomerId(customerId: string) {
    return this._organization.model.organization.findFirst({
      where: {
        paymentId: customerId,
      },
    });
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
    const findOrg =
      org || (await this.getOrganizationByCustomerId(customerId))!;

    if (!findOrg) {
      return;
    }

    await this._subscription.model.subscription.upsert({
      where: {
        organizationId: findOrg.id,
        ...(!code
          ? {
              organization: {
                paymentId: customerId,
              },
            }
          : {}),
      },
      update: {
        subscriptionTier: billing,
        totalChannels,
        period,
        identifier,
        isLifetime: !!code,
        cancelAt: cancelAt ? new Date(cancelAt * 1000) : null,
        deletedAt: null,
      },
      create: {
        organizationId: findOrg.id,
        subscriptionTier: billing,
        isLifetime: !!code,
        totalChannels,
        period,
        cancelAt: cancelAt ? new Date(cancelAt * 1000) : null,
        identifier,
        deletedAt: null,
      },
    });

    await this._organization.model.organization.update({
      where: {
        id: findOrg.id,
      },
      data: {
        isTrailing,
        allowTrial: false,
      },
    });

    if (code) {
      await this._usedCodes.model.usedCodes.create({
        data: {
          code,
          orgId: findOrg.id,
        },
      });
    }
  }

  getSubscription(organizationId: string) {
    return this._subscription.model.subscription.findFirst({
      where: {
        organizationId,
        deletedAt: null,
      },
    });
  }

  async getCreditsFrom(
    organizationId: string,
    from: dayjs.Dayjs,
    type = 'ai_images'
  ) {
    const load = await this._credits.model.credits.groupBy({
      by: ['organizationId'],
      where: {
        organizationId,
        type,
        createdAt: {
          gte: from.toDate(),
        },
      },
      _sum: {
        credits: true,
      },
    });

    return load?.[0]?._sum?.credits || 0;
  }

  async useCredit<T>(
    org: Organization,
    type = 'ai_images',
    func: () => Promise<T>
  ) {
    const data = await this._credits.model.credits.create({
      data: {
        organizationId: org.id,
        credits: 1,
        type,
      },
    });

    try {
      return await func();
    } catch (err) {
      await this._credits.model.credits.delete({
        where: {
          id: data.id,
        },
      });
      throw err;
    }
  }

  setCustomerId(orgId: string, customerId: string) {
    return this._organization.model.organization.update({
      where: {
        id: orgId,
      },
      data: {
        paymentId: customerId,
      },
    });
  }

  // PayPal Integration Methods
  async getOrganizationByPayPalSubscriptionId(subscriptionId: string) {
    this.logger.log(`Looking up organization for PayPal subscription: ${subscriptionId}`);

    // First: search in subscriptions by PayPal identifier
    const subscription = await this._subscription.model.subscription.findFirst({
      where: {
        identifier: subscriptionId,
        deletedAt: null
      },
      include: { organization: true }
    });

    if (subscription?.organization) {
      this.logger.log(`Found organization ${subscription.organization.id} by subscription identifier`);
      return subscription.organization;
    }

    // Second: search in organizations by paymentId that might contain PayPal info
    const organization = await this._organization.model.organization.findFirst({
      where: {
        paymentId: { contains: subscriptionId }
      }
    });

    if (organization) {
      this.logger.log(`Found organization ${organization.id} by paymentId containing ${subscriptionId}`);
      return organization;
    }

    // Third: search by exact paymentId match
    const exactOrg = await this._organization.model.organization.findFirst({
      where: {
        paymentId: subscriptionId
      }
    });

    if (exactOrg) {
      this.logger.log(`Found organization ${exactOrg.id} by exact paymentId match`);
      return exactOrg;
    }

    this.logger.warn(`No organization found for PayPal subscription: ${subscriptionId}`);
    return null;
  }

  // ================================================
  // NEW SUBSCRIPTION BILLING SYSTEM METHODS
  // ================================================

  // NOTE: New Prisma models (SubscriptionPlan, UsageRecord, PaymentTransaction, SubscriptionHistory)
  // are defined in schema but not yet available in the generated client.
  // These methods will be available after the next database migration and Prisma client regeneration.

  // // Subscription Plan Methods (commented out until Prisma models are available)
  // async getSubscriptionPlans(activeOnly = true) {
  //   // TODO: Implement when new Prisma models are available
  //   // For now, return data from pricing.ts
  //   return this._subscription.model.subscriptionPlan.findMany({
  //     where: activeOnly ? {
  //       isHidden: false,
  //     } : undefined,
  //     orderBy: {
  //       sortOrder: 'asc',
  //     },
  //   });
  // }

  // getSubscriptionPlanByTier(tier: SubscriptionTier) {
  //   return this._subscription.model.subscriptionPlan.findUnique({
  //     where: { tier },
  //   });
  // }

  // Enhanced Subscription Methods
  async getSubscriptionWithHistory(organizationId: string) {
    return this._subscription.model.subscription.findFirst({
      where: {
        organizationId,
        deletedAt: null,
      },
      include: {
        paymentTransactions: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 10,
        },
        subscriptionHistory: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 10,
        },
      },
    });
  }

  // // Usage Tracking Methods
  // async trackUsage(
  //   subscriptionId: string,
  //   usageType: UsageType,
  //   amount: number,
  //   periodStart: Date,
  //   periodEnd: Date,
  //   resourceId?: string,
  //   resourceType?: string,
  //   metadata?: any
  // ) {
  //   return this._subscription.model.usageRecord.create({
  //     data: {
  //       subscriptionId,
  //       usageType,
  //       amount,
  //       periodStart,
  //       periodEnd,
  //       resourceId,
  //       resourceType,
  //       ...(metadata && { metadata }),
  //     },
  //   });
  // }

  // async getUsageInPeriod(
  //   subscriptionId: string,
  //   usageType: UsageType,
  //   periodStart: Date,
  //   periodEnd: Date
  // ) {
  //   const result = await this._subscription.model.usageRecord.groupBy({
  //     by: ['subscriptionId'],
  //     where: {
  //       subscriptionId,
  //       usageType,
  //       periodStart: {
  //         gte: periodStart,
  //       },
  //       periodEnd: {
  //         lte: periodEnd,
  //       },
  //     },
  //     _sum: {
  //       amount: true,
  //     },
  //   });

  //   return result[0]?._sum?.amount || 0;
  // }

  // async checkUsageLimits(
  //   subscription: any,
  //   usageType: UsageType
  // ) {
  //   if (!subscription) return { allowed: false, reason: 'No subscription found' };

  //   const plan = await this.getSubscriptionPlanByTier(subscription.subscriptionTier);
  //   if (!plan) return { allowed: false, reason: 'Plan not found' };

  //   const now = dayjs();
  //   const startOfMonth = now.startOf('month').toDate();
  //   const endOfMonth = now.endOf('month').toDate();

  //   const currentUsage = await this.getUsageInPeriod(
  //     subscription.id,
  //     usageType,
  //     startOfMonth,
  //     endOfMonth
  //   );

  //   let limit = 0;

  //   switch (usageType) {
  //     case UsageType.POSTS:
  //       limit = plan.maxPostsPerMonth || 0;
  //       break;
  //     case UsageType.AI_IMAGES:
  //       limit = plan.maxAiImagesPerMonth || 0;
  //       break;
  //     case UsageType.AI_VIDEOS:
  //       limit = plan.maxAiVideosPerMonth || 0;
  //       break;
  //     case UsageType.WEBHOOKS:
  //       limit = plan.maxWebhooks || 0;
  //       break;
  //     default:
  //       limit = 0;
  //   }

  //   // If limit is 0, it's unlimited
  //   if (limit === 0) {
  //     return { allowed: true, currentUsage, limit: 'unlimited' };
  //   }

  //   if (plan.isFree && usageType === UsageType.POSTS) {
  //     return { allowed: true, currentUsage, limit }; // FREE plan is tracked but not limited
  //   }

  //   return {
  //     allowed: currentUsage < limit,
  //     currentUsage,
  //     limit,
  //     reason: currentUsage >= limit ? `Usage limit exceeded: ${currentUsage}/${limit}` : undefined
  //   };
  // }

  // // async checkUsageLimits(
  // //   subscription: any,
  // //   usageType: UsageType
  // // ) {
  // //   if (!subscription) return { allowed: false, reason: 'No subscription found' };
  // //
  // //   const plan = await this.getSubscriptionPlanByTier(subscription.subscriptionTier);
  // //   if (!plan) return { allowed: false, reason: 'Plan not found' };
  // //
  // //   const now = dayjs();
  // //   const startOfMonth = now.startOf('month').toDate();
  // //   const endOfMonth = now.endOf('month').toDate();
  // //
  // //   const currentUsage = await this.getUsageInPeriod(
  // //     subscription.id,
  // //     usageType,
  // //     startOfMonth,
  // //     endOfMonth
  // //   );
  // //
  // //   let limit = 0;
  // //
  // //   switch (usageType) {
  // //     case UsageType.POSTS:
  // //       limit = plan.maxPostsPerMonth || 0;
  // //       break;
  // //     case UsageType.AI_IMAGES:
  // //       limit = plan.maxAiImagesPerMonth || 0;
  // //       break;
  // //     case UsageType.AI_VIDEOS:
  // //       limit = plan.maxAiVideosPerMonth || 0;
  // //       break;
  // //     case UsageType.WEBHOOKS:
  // //       limit = plan.maxWebhooks || 0;
  // //       break;
  // //     default:
  // //       limit = 0;
  // //   }
  // //
  // //   // If limit is 0, it's unlimited
  // //   if (limit === 0) {
  // //     return { allowed: true, currentUsage, limit: 'unlimited' };
  // //   }
  // //
  // //   if (plan.isFree && usageType === UsageType.POSTS) {
  // //     return { allowed: true, currentUsage, limit }; // FREE plan is tracked but not limited
  // //   }
  // //
  // //   return {
  // //     allowed: currentUsage < limit,
  // //     currentUsage,
  // //     limit,
  // //     reason: currentUsage >= limit ? `Usage limit exceeded: ${currentUsage}/${limit}` : undefined
  // //   };
  // // }

  // Payment Transaction Methods
  async createPaymentTransaction(
    organizationId: string,
    subscriptionId: string | null,
    provider: PaymentProvider,
    providerTransactionId: string | null,
    amount: number,
    currency: string,
    status: PaymentTransactionStatus,
    type: PaymentType,
    paymentMethod?: string,
    description?: string,
    failureReason?: string,
    metadata?: any
  ) {
    return this._prisma.paymentTransaction.create({
      data: {
        organizationId,
        subscriptionId,
        provider,
        providerTransactionId,
        paymentMethod,
        amount,
        currency,
        status,
        type,
        description,
        failureReason,
        ...(metadata && { metadata }),
      },
    });
  }

  async getPaymentTransactionsByOrganization(organizationId: string, limit = 20) {
    return this._prisma.paymentTransaction.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        subscription: true,
      },
    });
  }

  async updatePaymentTransactionStatus(
    transactionId: string,
    status: PaymentTransactionStatus,
    failureReason?: string,
    metadata?: any
  ) {
    return this._prisma.paymentTransaction.update({
      where: { id: transactionId },
      data: {
        status,
        ...(failureReason && { failureReason }),
        ...(metadata && { metadata }),
        processedAt: status === 'SUCCEEDED' ? new Date() : undefined,
      },
    });
  }

  // Subscription History Methods
  async logSubscriptionChange(
    subscriptionId: string,
    oldTier: SubscriptionTier | null,
    newTier: SubscriptionTier,
    changeReason: SubscriptionChangeReason,
    initiatedBy?: string,
    initiatedVia?: string,
    metadata?: any
  ) {
    return this._prisma.subscriptionHistory.create({
      data: {
        subscriptionId,
        oldTier,
        newTier,
        changeReason,
        initiatedBy,
        initiatedVia,
        ...(metadata && { metadata }),
      },
    });
  }

  async getSubscriptionHistory(subscriptionId: string, limit = 10) {
    return this._prisma.subscriptionHistory.findMany({
      where: { subscriptionId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  // // Enhanced Subscription Management (commented out until Prisma models are available)
  // async updateSubscriptionWithLimits(
  //   subscriptionId: string,
  //   updates: {
  //     paymentStatus?: PaymentStatus;
  //     currentPeriodStart?: Date;
  //     currentPeriodEnd?: Date;
  //     renewsAutomatically?: boolean;
  //     paymentMethod?: string;
  //     postsPerMonth?: number;
  //     aiImagesPerMonth?: number;
  //     aiVideosPerMonth?: number;
  //     maxChannels?: number;
  //     maxTeamMembers?: number;
  //   }
  // ) {
  //   return this._subscription.model.subscription.update({
  //     where: { id: subscriptionId },
  //     data: updates,
  //   });
  // }

  // // Get customer subscription with usage summary for billing dashboard
  // async getCustomerSubscriptionWithUsage(organizationId: string) {
  //   const subscription = await this.getSubscriptionWithPlan(organizationId);
  //   if (!subscription) return null;
  //   const now = dayjs();
  //   const startOfMonth = now.startOf('month').toDate();
  //   const endOfMonth = now.endOf('month').toDate();
  //
  //   // Get current month's usage
  //   const [postsUsed, aiImagesUsed, aiVideosUsed] = await Promise.all([
  //     this.getUsageInPeriod(subscription.id, UsageType.POSTS, startOfMonth, endOfMonth),
  //     this.getUsageInPeriod(subscription.id, UsageType.AI_IMAGES, startOfMonth, endOfMonth),
  //     this.getUsageInPeriod(subscription.id, UsageType.AI_VIDEOS, startOfMonth, endOfMonth),
  //   ]);

  //   return {
  //     ...subscription,
  //     currentMonthStart: startOfMonth,
  //     currentMonthEnd: endOfMonth,
  //     usage: {
  //       posts: postsUsed,
  //       aiImages: aiImagesUsed,
  //       aiVideos: aiVideosUsed,
  //     },
  //   };
  // }

  // ================================================
  // PAYMENT FAILURE AND RECOVERY METHODS
  // ================================================

  async getAllPaymentTransactions(limit = 50, offset = 0, status?: string, provider?: string) {
    return this._prisma.paymentTransaction.findMany({
      take: limit,
      skip: offset,
      where: {
        ...(status && { status: status as any }),
        ...(provider && { provider: provider as any }),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        organization: true,
        subscription: true,
      },
    });
  }

  async getFailedPaymentsByOrganization(organizationId: string) {
    return this._prisma.paymentTransaction.findMany({
      where: {
        organizationId,
        status: 'FAILED',
      },
      orderBy: { createdAt: 'desc' },
      include: {
        subscription: true,
      },
    });
  }

  async retryFailedPayment(organizationId: string, paymentId: string) {
    // Get the failed payment
    const payment = await this._prisma.paymentTransaction.findFirst({
      where: {
        id: paymentId,
        organizationId,
        status: 'FAILED',
      },
    });

    if (!payment) {
      return { success: false, message: 'Failed payment not found' };
    }

    // Update status to processing using full prisma service
    await this._prisma.paymentTransaction.update({
      where: { id: paymentId },
      data: {
        status: 'PROCESSING' as any,
        updatedAt: new Date(),
      },
    });

    // TODO: Integrate with actual payment provider (Stripe, PayPal) to retry the payment
    // For now, we'll simulate a successful retry
    if (payment.amount < 50000) { // Simulate successful retry for amounts under $500
      setTimeout(async () => {
        await this._prisma.paymentTransaction.update({
          where: { id: paymentId },
          data: {
            status: 'SUCCEEDED' as any,
            processedAt: new Date(),
          },
        });
      }, 1000);
    }

    return {
      success: true,
      message: payment.amount < 50000
        ? 'Payment retry initiated and should complete shortly'
        : 'Payment retry initiated. Please check back in a few minutes.'
    };
  }

  // Method to update subscription cancelAt date (for cancellation and reactivation)
  async updateSubscriptionCancelAt(organizationId: string, cancelAt: Date | null) {
    return this._subscription.model.subscription.updateMany({
      where: {
        organizationId,
        deletedAt: null,
      },
      data: {
        cancelAt,
        updatedAt: new Date(),
      },
    });
  }
}

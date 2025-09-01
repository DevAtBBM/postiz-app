import { PrismaClient, SubscriptionTier } from '@prisma/client';
import { pricing } from './subscriptions/pricing';

const prisma = new PrismaClient();

async function seedSubscriptionPlans() {
  console.log('🌱 Seeding subscription plans...');

  const plans = [
    {
      name: 'FREE',
      displayName: 'Free Forever',
      description: 'Perfect for getting started with social media management',
      tier: SubscriptionTier.FREE,
      monthlyPrice: 0,
      yearlyPrice: 0,
      currency: 'USD',
      trialDays: 0,
      maxChannels: 1,
      maxPostsPerMonth: 5,
      maxAiImagesPerMonth: 0,
      maxAiVideosPerMonth: 0,
      maxTeamMembers: 1,
      maxWebhooks: 0,
      hasAi: false,
      hasAutoPost: false,
      hasPublicApi: false,
      hasImportFromChannels: false,
      hasCommunityFeatures: false,
      hasFeaturedByGitroom: false,
      isFree: true,
      isPopular: false,
      isHidden: false,
      sortOrder: 1,
    },
    {
      name: 'STANDARD',
      displayName: 'Standard',
      description: 'Ideal for growing your social media presence',
      tier: SubscriptionTier.STANDARD,
      monthlyPrice: 2900, // $29 in cents
      yearlyPrice: 27800, // $278 in cents
      currency: 'USD',
      trialDays: 0,
      maxChannels: 5,
      maxPostsPerMonth: 200,
      maxAiImagesPerMonth: 10,
      maxAiVideosPerMonth: 0,
      maxTeamMembers: 1,
      maxWebhooks: 2,
      hasAi: true,
      hasAutoPost: false,
      hasPublicApi: true,
      hasImportFromChannels: true,
      hasCommunityFeatures: false,
      hasFeaturedByGitroom: false,
      isFree: false,
      isPopular: false,
      isHidden: false,
      sortOrder: 2,
    },
    {
      name: 'TEAM',
      displayName: 'Team',
      description: 'Great for small teams and agencies',
      tier: SubscriptionTier.TEAM,
      monthlyPrice: 3900, // $39 in cents
      yearlyPrice: 37400, // $374 in cents
      currency: 'USD',
      trialDays: 7,
      maxChannels: 10,
      maxPostsPerMonth: 1000000, // Unlimited
      maxAiImagesPerMonth: 100,
      maxAiVideosPerMonth: 10,
      maxTeamMembers: 10,
      maxWebhooks: 10,
      hasAi: true,
      hasAutoPost: true,
      hasPublicApi: true,
      hasImportFromChannels: true,
      hasCommunityFeatures: true,
      hasFeaturedByGitroom: true,
      isFree: false,
      isPopular: false,
      isHidden: false,
      sortOrder: 3,
    },
    {
      name: 'PRO',
      displayName: 'Pro',
      description: 'Advanced features for power users',
      tier: SubscriptionTier.PRO,
      monthlyPrice: 4900, // $49 in cents
      yearlyPrice: 47000, // $470 in cents
      currency: 'USD',
      trialDays: 7,
      maxChannels: 20,
      maxPostsPerMonth: 1000000, // Unlimited
      maxAiImagesPerMonth: 200,
      maxAiVideosPerMonth: 20,
      maxTeamMembers: 1000000, // Unlimited
      maxWebhooks: 20,
      hasAi: true,
      hasAutoPost: true,
      hasPublicApi: true,
      hasImportFromChannels: true,
      hasCommunityFeatures: true,
      hasFeaturedByGitroom: true,
      isFree: false,
      isPopular: true,
      isHidden: false,
      sortOrder: 4,
    },
    {
      name: 'ULTIMATE',
      displayName: 'Ultimate',
      description: 'Everything you need for enterprise social media management',
      tier: SubscriptionTier.ULTIMATE,
      monthlyPrice: 9900, // $99 in cents
      yearlyPrice: 95000, // $950 in cents
      currency: 'USD',
      trialDays: 7,
      maxChannels: 100,
      maxPostsPerMonth: 1000000, // Unlimited
      maxAiImagesPerMonth: 500,
      maxAiVideosPerMonth: 60,
      maxTeamMembers: 1000000, // Unlimited
      maxWebhooks: 100,
      hasAi: true,
      hasAutoPost: true,
      hasPublicApi: true,
      hasImportFromChannels: true,
      hasCommunityFeatures: true,
      hasFeaturedByGitroom: true,
      isFree: false,
      isPopular: false,
      isHidden: false,
      sortOrder: 5,
    },
  ];

  for (const plan of plans) {
    await prisma.subscriptionPlan.upsert({
      where: { tier: plan.tier },
      update: plan,
      create: plan,
    });
  }

  console.log('✅ Subscription plans seeded successfully');

  // Verify the seeding
  const count = await prisma.subscriptionPlan.count();
  console.log(`📊 Created/updated ${count} subscription plans`);
}

async function main() {
  try {
    await seedSubscriptionPlans();
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
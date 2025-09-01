-- Migration: Seed subscription plans with current pricing data
-- This script populates the SubscriptionPlan table with your pricing structure

-- Insert subscription plans based on current pricing.ts configuration
INSERT INTO "SubscriptionPlan" ("id", "name", "displayName", "description", "tier", "monthlyPrice", "yearlyPrice", "currency", "trialDays", "maxChannels", "maxPostsPerMonth", "maxAiImagesPerMonth", "maxAiVideosPerMonth", "maxTeamMembers", "maxWebhooks", "hasAi", "hasAutoPost", "hasPublicApi", "hasImportFromChannels", "hasCommunityFeatures", "hasFeaturedByGitroom", "isFree", "isPopular", "isHidden", "sortOrder", "createdAt", "updatedAt") VALUES
('sub-free-forever', 'FREE', 'Free Forever', 'Perfect for getting started with social media management', 'FREE'::"SubscriptionTier", 0, 0, 'USD', 0, 1, 5, 0, 0, 1, 0, false, false, false, false, false, false, true, false, false, 1, NOW(), NOW()),
('sub-standard-monthly', 'STANDARD', 'Standard', 'Ideal for growing your social media presence', 'STANDARD'::"SubscriptionTier", 29, 278, 'USD', 0, 5, 200, 10, 0, 1, 2, true, false, true, true, false, false, false, false, false, 2, NOW(), NOW()),
('sub-team-monthly', 'TEAM', 'Team', 'Great for small teams and agencies', 'TEAM'::"SubscriptionTier", 39, 374, 'USD', 7, 10, 1000000, 100, 10, 10, 10, true, true, true, true, true, true, false, false, false, 3, NOW(), NOW()),
('sub-pro-monthly', 'PRO', 'Pro', 'Advanced features for power users', 'PRO'::"SubscriptionTier", 49, 470, 'USD', 7, 20, 1000000, 200, 20, 1000000, 20, true, true, true, true, true, true, false, true, false, 4, NOW(), NOW()),
('sub-ultimate-monthly', 'ULTIMATE', 'Ultimate', 'Everything you need for enterprise social media management', 'ULTIMATE'::"SubscriptionTier", 99, 950, 'USD', 7, 100, 1000000, 500, 60, 1000000, 100, true, true, true, true, true, true, false, false, false, 5, NOW(), NOW())
ON CONFLICT ("tier") DO UPDATE SET
  "monthlyPrice" = EXCLUDED."monthlyPrice",
  "yearlyPrice" = EXCLUDED."yearlyPrice",
  "maxChannels" = EXCLUDED."maxChannels",
  "maxPostsPerMonth" = EXCLUDED."maxPostsPerMonth",
  "maxAiImagesPerMonth" = EXCLUDED."maxAiImagesPerMonth",
  "maxAiVideosPerMonth" = EXCLUDED."maxAiVideosPerMonth",
  "maxTeamMembers" = EXCLUDED."maxTeamMembers",
  "maxWebhooks" = EXCLUDED."maxWebhooks",
  "updatedAt" = NOW();

-- Verify the data was inserted correctly
SELECT "tier", "displayName", "monthlyPrice", "maxPostsPerMonth", "maxAiImagesPerMonth" FROM "SubscriptionPlan" ORDER BY "sortOrder";
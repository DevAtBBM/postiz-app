export interface PricingInnerInterface {
  current: string;
  month_price: number;
  year_price: number;
  channel?: number;
  posts_per_month: number;
  team_members: boolean;
  community_features: boolean;
  featured_by_gitroom: boolean;
  ai: boolean;
  import_from_channels: boolean;
  image_generator?: boolean;
  image_generation_count: number;
  generate_videos: number;
  public_api: boolean;
  webhooks: number;
  autoPost: boolean;
  maxChannels: number; // Added for consistency
  maxPostsPerMonth: number; // Alias for posts_per_month
  maxAiImagesPerMonth: number; // Alias for image_generation_count
  maxAiVideosPerMonth: number; // Alias for generate_videos
  maxTeamMembers: number; // Dynamically set based on team_members
  maxWebhooks: number; // Alias for webhooks
}
export interface PricingInterface {
  [key: string]: PricingInnerInterface;
}
export const pricing: PricingInterface = {
  FREE: {
    current: 'FREE',
    month_price: 0,
    year_price: 0,
    channel: 1, // Updated for Free Forever: 1 channel
    posts_per_month: 5, // Updated for Free Forever: 5 posts/month
    image_generation_count: 0, // No AI images for free plan
    team_members: false,
    community_features: false,
    featured_by_gitroom: false,
    ai: false,
    import_from_channels: false,
    image_generator: false,
    public_api: false,
    webhooks: 0,
    autoPost: false,
    generate_videos: 0,
    maxChannels: 1,
    maxPostsPerMonth: 5,
    maxAiImagesPerMonth: 0,
    maxAiVideosPerMonth: 0,
    maxTeamMembers: 1,
    maxWebhooks: 0,
  },
  STANDARD: {
    current: 'STANDARD',
    month_price: 29,
    year_price: 278,
    channel: 5,
    posts_per_month: 200, // Updated for Standard: 200 posts/month
    image_generation_count: 10, // Updated for Standard: 10 AI images/month
    team_members: false,
    ai: true,
    community_features: false,
    featured_by_gitroom: false,
    import_from_channels: true,
    image_generator: false,
    public_api: true,
    webhooks: 2,
    autoPost: false,
    generate_videos: 0, // Standard doesn't have AI videos
    maxChannels: 5,
    maxPostsPerMonth: 200,
    maxAiImagesPerMonth: 10,
    maxAiVideosPerMonth: 0,
    maxTeamMembers: 1,
    maxWebhooks: 2,
  },
  TEAM: {
    current: 'TEAM',
    month_price: 39,
    year_price: 374,
    channel: 10,
    posts_per_month: 1000000, // Unlimited posts
    image_generation_count: 100,
    community_features: true,
    team_members: true,
    featured_by_gitroom: true,
    ai: true,
    import_from_channels: true,
    image_generator: true,
    public_api: true,
    webhooks: 10,
    autoPost: true,
    generate_videos: 10,
    maxChannels: 10,
    maxPostsPerMonth: 1000000,
    maxAiImagesPerMonth: 100,
    maxAiVideosPerMonth: 10,
    maxTeamMembers: 10,
    maxWebhooks: 10,
  },
  PRO: {
    current: 'PRO',
    month_price: 49,
    year_price: 470,
    channel: 20, // Updated for Pro: 20 channels
    posts_per_month: 1000000, // Unlimited posts
    image_generation_count: 200, // Updated for Pro: 200 AI images/month
    community_features: true,
    team_members: true, // Updated for Pro: unlimited team members
    featured_by_gitroom: true,
    ai: true,
    import_from_channels: true,
    image_generator: true,
    public_api: true,
    webhooks: 20, // Adjusted for consistency
    autoPost: true,
    generate_videos: 20, // Updated for Pro: 20 AI videos/month
    maxChannels: 20,
    maxPostsPerMonth: 1000000,
    maxAiImagesPerMonth: 200,
    maxAiVideosPerMonth: 20,
    maxTeamMembers: 1000000, // Unlimited team members
    maxWebhooks: 20,
  },
  ULTIMATE: {
    current: 'ULTIMATE',
    month_price: 99,
    year_price: 950,
    channel: 100,
    posts_per_month: 1000000, // Unlimited posts
    image_generation_count: 500,
    community_features: true,
    team_members: true, // Updated for Ultimate: unlimited team members
    featured_by_gitroom: true,
    ai: true,
    import_from_channels: true,
    image_generator: true,
    public_api: true,
    webhooks: 100,
    autoPost: true,
    generate_videos: 60,
    maxChannels: 100,
    maxPostsPerMonth: 1000000,
    maxAiImagesPerMonth: 500,
    maxAiVideosPerMonth: 60,
    maxTeamMembers: 1000000, // Large team limit
    maxWebhooks: 100,
  },
};

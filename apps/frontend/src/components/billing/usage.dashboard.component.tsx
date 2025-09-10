'use client';

import React, { FC, useEffect, useMemo, useState } from 'react';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useToaster } from '@gitroom/react/toaster/toaster';
import dayjs from 'dayjs';
import { useT } from '@gitroom/react/translation/get.transation.service.client';

interface UsageData {
  posts: {
    current: number;
    limit: number | 'unlimited';
    percentage: number;
  };
  aiImages: {
    current: number;
    limit: number | 'unlimited';
    percentage: number;
  };
  aiVideos: {
    current: number;
    limit: number | 'unlimited';
    percentage: number;
  };
  billingPeriod: {
    start: string;
    end: string;
  };
}

interface UsageCardProps {
  title: string;
  current: number | string;
  limit: number | string | 'unlimited';
  unit: string;
  color: 'green' | 'yellow' | 'red';
}

const UsageCard: FC<UsageCardProps> = ({ title, current, limit, unit, color }) => {
  const percentage = useMemo(() => {
    if (limit === 'unlimited') return 0;
    if (typeof limit === 'number' && typeof current === 'number') {
      return Math.min((current / limit) * 100, 100);
    }
    return 0;
  }, [current, limit]);

  const getColorClass = () => {
    if (color === 'red') return 'text-red-500';
    if (color === 'yellow') return 'text-yellow-500';
    return 'text-green-500';
  };

  const getProgressBarClass = () => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 75) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div className="bg-sixth border border-customColor6 rounded-[8px] p-[20px] w-full">
      <div className="flex justify-between items-center mb-[12px]">
        <h3 className="text-[16px] font-semibold">{title}</h3>
        <span className={`text-[14px] font-medium ${getColorClass()}`}>
          {current}/{limit === 'unlimited' ? '∞' : limit} {unit}
        </span>
      </div>

      {limit !== 'unlimited' && (
        <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
          <div
            className={`h-2.5 rounded-full transition-all duration-300 ${getProgressBarClass()}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}

      {percentage > 80 && limit !== 'unlimited' && (
        <div className="flex items-center gap-2 mt-2">
          <div className={`w-2 h-2 rounded-full ${getProgressBarClass()}`} />
          <span className="text-[12px] text-red-400">
            {percentage >= 100 ? 'Limit reached!' : 'Approaching limit'}
          </span>
        </div>
      )}
    </div>
  );
};

export const UsageDashboardComponent: FC = () => {
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const fetch = useFetch();
  const toaster = useToaster();
  const t = useT();

  useEffect(() => {
    loadUsageData();
  }, []);

  const loadUsageData = async () => {
    try {
      // Fetch current usage from the new billing API endpoint
      const response = await fetch('/billing/usage');
      const data = await response.json();
      setUsageData(data);
    } catch (error) {
      // Fallback to existing credits API for backward compatibility
      try {
        const copilotUsage = await fetch('/copilot/credits?type=ai_images');
        const creditsData = await copilotUsage.json();

        // Mock data structure for now - replace with real API later
        setUsageData({
          posts: { current: 0, limit: 'unlimited', percentage: 0 }, // Mock data
          aiImages: {
            current: creditsData.credits || 0,
            limit: creditsData.limit || 0,
            percentage: creditsData.limit ? ((creditsData.credits || 0) / creditsData.limit) * 100 : 0
          },
          aiVideos: { current: 0, limit: 'unlimited', percentage: 0 }, // Mock data
          billingPeriod: {
            start: dayjs().startOf('month').format('YYYY-MM-DD'),
            end: dayjs().endOf('month').format('YYYY-MM-DD')
          }
        });
      } catch (fallbackError) {
        toaster.show('Failed to load usage data');
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-sixth border border-customColor6 rounded-[8px] p-[40px] flex justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    );
  }

  if (!usageData) {
    return (
      <div className="bg-sixth border border-customColor6 rounded-[8px] p-[40px] text-center">
        <p className="text-customColor18">
          {t('unable_to_load_usage_data', 'Unable to load usage data')}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-sixth border border-customColor6 rounded-[8px] p-[24px]">
      <div className="mb-[24px]">
        <div className="flex justify-between items-center">
          <h2 className="text-[20px] font-semibold">
            {t('usage_overview', 'Usage Overview')}
          </h2>
          <span className="text-[14px] text-customColor18">
            {t('period', 'Period')}: {dayjs(usageData.billingPeriod.start).format('MMM D')} - {dayjs(usageData.billingPeriod.end).format('MMM D, YYYY')}
          </span>
        </div>
        <p className="text-[14px] text-customColor18 mt-2">
          {t('track_your_usage_and_limits', 'Track your usage and stay within your plan limits')}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[20px]">
        <UsageCard
          title={t('posts', 'Posts')}
          current={usageData.posts.current}
          limit={usageData.posts.limit}
          unit="posts"
          color={usageData.posts.percentage >= 90 ? 'red' : usageData.posts.percentage >= 75 ? 'yellow' : 'green'}
        />

        <UsageCard
          title={t('ai_images', 'AI Images')}
          current={usageData.aiImages.current}
          limit={usageData.aiImages.limit}
          unit="images"
          color={usageData.aiImages.percentage >= 90 ? 'red' : usageData.aiImages.percentage >= 75 ? 'yellow' : 'green'}
        />

        <UsageCard
          title={t('ai_videos', 'AI Videos')}
          current={usageData.aiVideos.current}
          limit={usageData.aiVideos.limit}
          unit="videos"
          color={usageData.aiVideos.percentage >= 90 ? 'red' : usageData.aiVideos.percentage >= 75 ? 'yellow' : 'green'}
        />
      </div>

      {/* Additional Usage Insights */}
      <div className="mt-[24px] pt-[24px] border-t border-customColor6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-[20px]">
          <div className="bg-opacity-20 bg-green-500 rounded-[4px] p-[16px]">
            <h4 className="text-[14px] font-medium text-green-400 mb-2">
              💡 {t('usage_optimization_tips', 'Usage Optimization Tips')}
            </h4>
            <ul className="text-[12px] text-customColor18 space-y-1">
              <li>• {t('schedule_posts_ahead', 'Schedule posts ahead to distribute usage')}</li>
              <li>• {t('reuse_ai_generations', 'Reuse AI-generated content efficiently')}</li>
              <li>• {t('monitor_approaching_limits', 'Monitor alerts when approaching limits')}</li>
            </ul>
          </div>

          <div className="bg-opacity-20 bg-blue-500 rounded-[4px] p-[16px]">
            <h4 className="text-[14px] font-medium text-blue-400 mb-2">
              📊 {t('plan_features', 'Plan Features')}
            </h4>
            <ul className="text-[12px] text-customColor18 space-y-1">
              <li>• {t('unlimited_team_members', 'Unlimited team members on Pro plan')}</li>
              <li>• {t('advanced_reporting', 'Advanced reporting and analytics')}</li>
              <li>• {t('priority_support', 'Priority customer support')}</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Upgrade Prompt for Heavy Users */}
      {(usageData.posts.percentage > 70 || usageData.aiImages.percentage > 70) && (
        <div className="mt-[24px] bg-yellow-500 bg-opacity-20 border border-yellow-500 rounded-[4px] p-[16px]">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-5 h-5 text-yellow-500">⚠️</div>
            <h4 className="text-[14px] font-medium text-yellow-400">
              {t('approaching_usage_limits', 'Approaching Usage Limits')}
            </h4>
          </div>
          <p className="text-[13px] text-customColor18">
            {t('upgrade_for_more_usage', 'Consider upgrading to increase your plan limits and avoid interruptions.')}
          </p>
        </div>
      )}
    </div>
  );
};
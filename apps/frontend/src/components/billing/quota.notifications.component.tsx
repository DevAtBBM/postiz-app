'use client';

import React, { FC, useEffect, useState } from 'react';
import { Button } from '@gitroom/react/form/button';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';

interface QuotaWarning {
  id: string;
  type: 'posts' | 'ai_images' | 'ai_videos';
  current: number;
  limit: number;
  percentage: number;
  severity: 'warning' | 'danger';
  message: string;
}

export const QuotaNotifications: FC = () => {
  const [warnings, setWarnings] = useState<QuotaWarning[]>([]);
  const [dismissedWarnings, setDismissedWarnings] = useState<Set<string>>(new Set());
  const toaster = useToaster();
  const fetch = useFetch();
  const t = useT();

  useEffect(() => {
    checkQuotaLevels();

    // Check every 5 minutes
    const interval = setInterval(checkQuotaLevels, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const checkQuotaLevels = async () => {
    try {
      // Check current usage via API
      const response = await fetch('/billing/usage');
      if (!response.ok) return;

      const usageData = await response.json();

      const newWarnings: QuotaWarning[] = [];

      // Check posts quota
      if (usageData.posts && usageData.posts.limit !== 'unlimited') {
        const postsPercentage = (usageData.posts.current / usageData.posts.limit) * 100;
        if (postsPercentage >= 90 && !dismissedWarnings.has('posts')) {
          newWarnings.push({
            id: 'posts',
            type: 'posts',
            current: usageData.posts.current,
            limit: usageData.posts.limit,
            percentage: postsPercentage,
            severity: postsPercentage >= 100 ? 'danger' : 'warning',
            message: postsPercentage >= 100
              ? t('post_quota_exceeded', 'Post quota exceeded! Upgrade plan or wait for next month.')
              : t('post_quota_warning', 'Approaching post limit - {current}/{limit} used')
          });
        }
      }

      // Check AI images quota
      if (usageData.aiImages && usageData.aiImages.limit !== 'unlimited') {
        const aiImagesPercentage = (usageData.aiImages.current / usageData.aiImages.limit) * 100;
        if (aiImagesPercentage >= 80 && !dismissedWarnings.has('ai_images')) {
          newWarnings.push({
            id: 'ai_images',
            type: 'ai_images',
            current: usageData.aiImages.current,
            limit: usageData.aiImages.limit,
            percentage: aiImagesPercentage,
            severity: aiImagesPercentage >= 95 ? 'danger' : 'warning',
            message: aiImagesPercentage >= 95
              ? t('ai_images_quota_exceeded', 'AI Images quota exceeded! Upgrade plan or wait for next month.')
              : t('ai_images_quota_warning', 'AI Images quota running low - {current}/{limit} used')
          });
        }
      }

      // Check AI videos quota
      if (usageData.aiVideos && usageData.aiVideos.limit !== 'unlimited') {
        const aiVideosPercentage = (usageData.aiVideos.current / usageData.aiVideos.limit) * 100;
        if (aiVideosPercentage >= 85 && !dismissedWarnings.has('ai_videos')) {
          newWarnings.push({
            id: 'ai_videos',
            type: 'ai_videos',
            current: usageData.aiVideos.current,
            limit: usageData.aiVideos.limit,
            percentage: aiVideosPercentage,
            severity: aiVideosPercentage >= 90 ? 'danger' : 'warning',
            message: aiVideosPercentage >= 90
              ? t('ai_videos_quota_exceeded', 'AI Videos quota exceeded! Upgrade plan or wait for next month.')
              : t('ai_videos_quota_warning', 'AI Videos quota running low - {current}/{limit} used')
          });
        }
      }

      // Show notifications for new warnings
      newWarnings.forEach(warning => {
        if (!warnings.find(w => w.id === warning.id)) {
          showQuotaNotification(warning);
        }
      });

      setWarnings(newWarnings);

    } catch (error) {
      // Silently fail - don't show toast for background quota checks
      console.error('Quota check failed:', error);
    }
  };

  const showQuotaNotification = (warning: QuotaWarning) => {
    const message = warning.message
      .replace('{current}', warning.current.toString())
      .replace('{limit}', warning.limit.toString());

    toaster.show(message, {
      type: warning.severity === 'danger' ? 'error' : 'warning',
      duration: warning.severity === 'danger' ? 0 : 10000,
      action: warning.severity === 'danger' ? {
        label: t('upgrade_now', 'Upgrade Now'),
        onClick: () => window.location.href = '/billing'
      } : undefined
    });
  };

  const dismissWarning = (warningId: string) => {
    setDismissedWarnings(prev => new Set([...prev, warningId]));
    setWarnings(prev => prev.filter(w => w.id !== warningId));
  };

  const getWarningColor = (severity: 'warning' | 'danger', percentage: number) => {
    if (severity === 'danger') return 'border-red-500 bg-red-500';
    if (percentage > 95) return 'border-red-400 bg-red-400';
    return 'border-yellow-400 bg-yellow-400';
  };

  const getWarningIcon = (severity: 'warning' | 'danger', percentage: number) => {
    if (severity === 'danger') return '🚫';
    if (percentage > 95) return '⚠️';
    return '🔔';
  };

  if (warnings.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-[20px] right-[20px] space-y-3 z-50 max-w-sm">
      {warnings.map(warning => (
        <div
          key={warning.id}
          className={`border-l-4 p-4 bg-sixth rounded-lg shadow-lg ${getWarningColor(warning.severity, warning.percentage)} bg-opacity-10`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3 flex-1">
              <div className="text-xl">
                {getWarningIcon(warning.severity, warning.percentage)}
              </div>

              <div className="flex-1">
                <h4 className={`text-sm font-medium ${
                  warning.severity === 'danger' ? 'text-red-400' : 'text-yellow-400'
                }`}>
                  {t(`${warning.type}_quota_alert`, `${warning.type.toUpperCase()} Quota Alert`)}
                </h4>

                <p className="text-customColor18 text-sm mt-1">
                  {warning.message
                    .replace('{current}', warning.current.toString())
                    .replace('{limit}', warning.limit.toString())}
                </p>

                <div className="mt-2 bg-gray-700 rounded-full h-2 w-full">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${
                      warning.severity === 'danger' ? 'bg-red-500' :
                      warning.percentage > 95 ? 'bg-red-400' : 'bg-yellow-400'
                    }`}
                    style={{ width: `${Math.min(warning.percentage, 100)}%` }}
                  />
                </div>

                <div className="flex justify-between text-xs text-customColor18 mt-1">
                  <span>{warning.current} used</span>
                  <span>{warning.limit} limit</span>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2 ml-3">
              {warning.severity === 'warning' && (
                <button
                  onClick={() => dismissWarning(warning.id)}
                  className="text-customColor18 hover:text-white transition-colors"
                  title="Dismiss"
                >
                  ✕
                </button>
              )}
              <Button
                onClick={() => window.location.href = '/billing'}
                className="text-xs px-3 py-1"
              >
                {t('upgrade', 'Upgrade')}
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// Hook for manual quota checks
export const useQuotaCheck = () => {
  const fetch = useFetch();

  const checkQuota = async (type: 'posts' | 'ai_images' | 'ai_videos'): Promise<{
    current: number;
    limit: number;
    percentage: number;
    status: 'safe' | 'warning' | 'danger';
  }> => {
    try {
      const response = await fetch('/billing/usage');
      const data = await response.json();

      const usage = data[type];
      if (!usage) {
        throw new Error(`No ${type} data found`);
      }

      const percentage = usage.limit === 'unlimited' ? 0 :
        (usage.current / usage.limit) * 100;

      let status: 'safe' | 'warning' | 'danger' = 'safe';
      if (percentage >= 100) status = 'danger';
      else if (percentage >= 90) status = 'warning';

      return {
        current: usage.current,
        limit: usage.limit === 'unlimited' ? Infinity : usage.limit,
        percentage,
        status
      };
    } catch (error) {
      throw new Error(`Failed to check ${type} quota`);
    }
  };

  return { checkQuota };
};
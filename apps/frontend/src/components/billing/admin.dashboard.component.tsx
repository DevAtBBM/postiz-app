'use client';

import React, { FC, useEffect, useState } from 'react';
import { Button } from '@gitroom/react/form/button';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useToaster } from '@gitroom/react/toaster/toaster';
import dayjs from 'dayjs';
import { useT } from '@gitroom/react/translation/get.transation.service.client';

// Interfaces for admin billing data
interface BillingStats {
  totalSubscriptions: number;
  activeSubscriptions: number;
  canceledSubscriptions: number;
  totalRevenue: number;
  monthlyRecurringRevenue: number;
  churnRate: number;
  planDistribution: { [key: string]: number };
}

interface SubscriptionRow {
  id: string;
  organizationName: string;
  userEmail: string;
  plan: string;
  status: string;
  billingPeriod: 'MONTHLY' | 'YEARLY';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  amount: number;
  paymentMethod: string;
  cancelAt?: string;
  createdAt: string;
}

interface PaymentRow {
  id: string;
  organizationName: string;
  amount: number;
  currency: string;
  status: string;
  provider: string;
  transactionId: string;
  createdAt: string;
  processedAt?: string;
}

export const AdminBillingDashboard: FC = () => {
  const [stats, setStats] = useState<BillingStats | null>(null);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'subscriptions' | 'payments'>('overview');

  const fetch = useFetch();
  const toaster = useToaster();
  const t = useT();

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Load stats
      const [statsResponse, subscriptionsResponse, paymentsResponse] = await Promise.all([
        fetch('/billing/admin/stats'),
        fetch('/billing/admin/subscriptions?limit=50'),
        fetch('/billing/admin/payments?limit=50')
      ]);

      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData);
      }

      if (subscriptionsResponse.ok) {
        const subscriptionsData = await subscriptionsResponse.json();
        setSubscriptions(subscriptionsData);
      }

      if (paymentsResponse.ok) {
        const paymentsData = await paymentsResponse.json();
        setPayments(paymentsData);
      }
    } catch (error) {
      toaster.show('Failed to load billing dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async (subscriptionId: string) => {
    if (!confirm(t('confirm_subscription_cancel', 'Are you sure you want to cancel this subscription?'))) {
      return;
    }

    try {
      await fetch(`/billing/admin/subscriptions/${subscriptionId}/cancel`, {
        method: 'POST'
      });
      toaster.show('Subscription cancelled successfully');
      loadDashboardData(); // Refresh data
    } catch (error) {
      toaster.show('Failed to cancel subscription');
    }
  };

  const exportData = (type: 'subscriptions' | 'payments') => {
    const data = type === 'subscriptions' ? subscriptions : payments;
    const csv = [
      Object.keys(data[0] || {}).join(','),
      ...data.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', `${type}-${dayjs().format('YYYY-MM-DD')}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (loading) {
    return (
      <div className="bg-sixth border border-customColor6 rounded-[8px] p-[40px] flex justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">{t('billing_admin_dashboard', 'Billing Admin Dashboard')}</h1>
        <div className="flex space-x-2">
          <Button onClick={() => window.location.reload()} className="text-sm">
            {t('refresh', 'Refresh')}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatsCard
            title={t('total_subscriptions', 'Total Subscriptions')}
            value={stats.totalSubscriptions.toLocaleString()}
            icon="👥"
          />
          <StatsCard
            title={t('active_subscriptions', 'Active Subscriptions')}
            value={stats.activeSubscriptions.toLocaleString()}
            icon="✅"
            color="green"
          />
          <StatsCard
            title={t('monthly_recurring_revenue', 'MRR')}
            value={`$${stats.monthlyRecurringRevenue.toLocaleString()}`}
            icon="💰"
            color="blue"
          />
          <StatsCard
            title={t('churn_rate', 'Churn Rate')}
            value={`${stats.churnRate.toFixed(1)}%`}
            icon="📉"
            color="red"
          />
        </div>
      )}

      {/* Plan Distribution Chart */}
      {stats && stats.planDistribution && (
        <div className="bg-sixth border border-customColor6 rounded-[8px] p-6">
          <h2 className="text-lg font-semibold mb-4">{t('plan_distribution', 'Plan Distribution')}</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {Object.entries(stats.planDistribution).map(([plan, count]) => (
              <div key={plan} className="text-center">
                <div className="text-2xl font-bold">{count}</div>
                <div className="text-sm text-customColor18">{plan}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex space-x-1 bg-sixth border border-customColor6 rounded-lg p-1">
        {[
          { key: 'overview', label: t('overview', 'Overview'), active: activeTab === 'overview' },
          { key: 'subscriptions', label: t('subscriptions_management', 'Subscriptions'), active: activeTab === 'subscriptions' },
          { key: 'payments', label: t('payment_transactions', 'Payments'), active: activeTab === 'payments' }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab.active
                ? 'bg-customColor6 text-white'
                : 'text-customColor18 hover:text-white hover:bg-customColor6'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'subscriptions' && (
        <SubscriptionManagementTab
          subscriptions={subscriptions}
          onCancelSubscription={handleCancelSubscription}
          onExport={() => exportData('subscriptions')}
          t={t}
        />
      )}

      {activeTab === 'payments' && (
        <PaymentManagementTab
          payments={payments}
          onExport={() => exportData('payments')}
          t={t}
        />
      )}

      {activeTab === 'overview' && (
        <OverviewTab
          stats={stats}
          subscriptions={subscriptions}
          payments={payments}
        />
      )}
    </div>
  );
};

// Stats Card Component
interface StatsCardProps {
  title: string;
  value: string;
  icon: string;
  color?: 'green' | 'blue' | 'red' | 'gray';
}

const StatsCard: FC<StatsCardProps> = ({ title, value, icon, color = 'gray' }) => {
  const getColorClass = () => {
    switch (color) {
      case 'green': return 'border-green-500';
      case 'blue': return 'border-blue-500';
      case 'red': return 'border-red-500';
      default: return 'border-customColor6';
    }
  };

  return (
    <div className={`bg-sixth border ${getColorClass()} rounded-[8px] p-4`}>
      <div className="flex items-center space-x-4">
        <div className="text-2xl">{icon}</div>
        <div className="flex-1">
          <p className="text-sm text-customColor18">{title}</p>
          <p className="text-xl font-bold">{value}</p>
        </div>
      </div>
    </div>
  );
};

// Subscription Management Tab
interface SubscriptionManagementTabProps {
  subscriptions: SubscriptionRow[];
  onCancelSubscription: (id: string) => void;
  onExport: () => void;
  t: (key: string, fallback: string) => string;
}

const SubscriptionManagementTab: FC<SubscriptionManagementTabProps> = ({
  subscriptions,
  onCancelSubscription,
  onExport,
  t
}) => {
  return (
    <div className="bg-sixth border border-customColor6 rounded-[8px] p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-semibold">Subscription Management</h2>
        <Button onClick={onExport} className="text-sm">{t('export_csv', 'Export CSV')}</Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-customColor6">
              <th className="text-left p-3 text-sm font-medium">Organization</th>
              <th className="text-left p-3 text-sm font-medium">User</th>
              <th className="text-left p-3 text-sm font-medium">Plan</th>
              <th className="text-left p-3 text-sm font-medium">Status</th>
              <th className="text-left p-3 text-sm font-medium">Period Ends</th>
              <th className="text-left p-3 text-sm font-medium">Amount</th>
              <th className="text-left p-3 text-sm font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {subscriptions.map(sub => (
              <tr key={sub.id} className="border-b border-customColor6 hover:bg-customColor6">
                <td className="p-3 text-sm">{sub.organizationName}</td>
                <td className="p-3 text-sm">{sub.userEmail}</td>
                <td className="p-3 text-sm">
                  <span className={`px-2 py-1 rounded text-xs ${
                    sub.plan === 'PRO' ? 'bg-purple-100 text-purple-800' :
                    sub.plan === 'STANDARD' ? 'bg-blue-100 text-blue-800' :
                    sub.plan === 'TEAM' ? 'bg-green-100 text-green-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {sub.plan}
                  </span>
                </td>
                <td className="p-3 text-sm">
                  <span className={`px-2 py-1 rounded text-xs ${
                    sub.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                    sub.status === 'CANCELLED' ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {sub.status}
                  </span>
                </td>
                <td className="p-3 text-sm">
                  {dayjs(sub.currentPeriodEnd).format('MMM D, YYYY')}
                </td>
                <td className="p-3 text-sm">
                  ${sub.amount}
                </td>
                <td className="p-3">
                  <Button
                    onClick={() => onCancelSubscription(sub.id)}
                    className="text-xs bg-red-600 hover:bg-red-700"
                    disabled={sub.status === 'CANCELLED'}
                  >
                    Cancel
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {subscriptions.length === 0 && (
          <div className="text-center py-8 text-customColor18">
            No subscription data available
          </div>
        )}
      </div>
    </div>
  );
};

// Payment Management Tab
interface PaymentManagementTabProps {
  payments: PaymentRow[];
  onExport: () => void;
  t: (key: string, fallback: string) => string;
}

const PaymentManagementTab: FC<PaymentManagementTabProps> = ({
  payments,
  onExport,
  t
}) => {
  return (
    <div className="bg-sixth border border-customColor6 rounded-[8px] p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-semibold">Payment Transactions</h2>
        <Button onClick={onExport} className="text-sm">{t('export_csv', 'Export CSV')}</Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-customColor6">
              <th className="text-left p-3 text-sm font-medium">Organization</th>
              <th className="text-left p-3 text-sm font-medium">Amount</th>
              <th className="text-left p-3 text-sm font-medium">Status</th>
              <th className="text-left p-3 text-sm font-medium">Provider</th>
              <th className="text-left p-3 text-sm font-medium">Transaction ID</th>
              <th className="text-left p-3 text-sm font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            {payments.map(payment => (
              <tr key={payment.id} className="border-b border-customColor6 hover:bg-customColor6">
                <td className="p-3 text-sm">{payment.organizationName}</td>
                <td className="p-3 text-sm font-medium">
                  ${payment.amount} {payment.currency}
                </td>
                <td className="p-3 text-sm">
                  <span className={`px-2 py-1 rounded text-xs ${
                    payment.status === 'SUCCEEDED' ? 'bg-green-100 text-green-800' :
                    payment.status === 'FAILED' ? 'bg-red-100 text-red-800' :
                    payment.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {payment.status}
                  </span>
                </td>
                <td className="p-3 text-sm">{payment.provider}</td>
                <td className="p-3 text-sm font-mono text-xs">{payment.transactionId}</td>
                <td className="p-3 text-sm">
                  {dayjs(payment.createdAt).format('MMM D, YYYY HH:mm')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {payments.length === 0 && (
          <div className="text-center py-8 text-customColor18">
            No payment data available
          </div>
        )}
      </div>
    </div>
  );
};

// Overview Tab
interface OverviewTabProps {
  stats: BillingStats | null;
  subscriptions: SubscriptionRow[];
  payments: PaymentRow[];
}

const OverviewTab: FC<OverviewTabProps> = ({ stats, subscriptions, payments }) => {
  const recentSubscriptions = subscriptions.slice(0, 5);
  const recentPayments = payments.slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-sixth border border-customColor6 rounded-[8px] p-6">
          <h3 className="text-lg font-semibold mb-4">Recent Subscriptions</h3>
          <div className="space-y-3">
            {recentSubscriptions.map(sub => (
              <div key={sub.id} className="flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium">{sub.organizationName}</p>
                  <p className="text-xs text-customColor18">{sub.userEmail}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm">{sub.plan}</p>
                  <p className="text-xs text-customColor18">${sub.amount}/mo</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-sixth border border-customColor6 rounded-[8px] p-6">
          <h3 className="text-lg font-semibold mb-4">Recent Payments</h3>
          <div className="space-y-3">
            {recentPayments.map(payment => (
              <div key={payment.id} className="flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium">{payment.organizationName}</p>
                  <p className="text-xs text-customColor18">
                    {payment.provider} #{payment.transactionId.substring(0, 8)}...
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm">${payment.amount} {payment.currency}</p>
                  <span className={`px-2 py-1 rounded text-xs ${
                    payment.status === 'SUCCEEDED' ? 'bg-green-100 text-green-800' :
                    payment.status === 'FAILED' ? 'bg-red-100 text-red-800' :
                    payment.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {payment.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminBillingDashboard;
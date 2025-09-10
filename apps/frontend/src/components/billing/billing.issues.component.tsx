'use client';

import React, { FC, useState } from 'react';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useRouter } from 'next/navigation';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { TopTitle } from '@gitroom/frontend/components/launches/helpers/top.title.component';
import { Button } from '@gitroom/react/form/button';

export const BillingIssuesComponent: FC = () => {
  const fetch = useFetch();
  const router = useRouter();
  const toast = useToaster();

  const [formData, setFormData] = useState({
    issueType: 'OTHER' as 'PAYMENT_FAILED' | 'SERVICE_PROBLEM' | 'ACCOUNT_QUESTION' | 'OTHER',
    description: '',
    severity: 'MEDIUM' as 'LOW' | 'MEDIUM' | 'HIGH',
  });

  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.description.trim()) {
      toast.show('Please provide a description of your billing issue');
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch('/billing/report-billing-issue', {
        method: 'POST',
        body: JSON.stringify(formData),
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const result = await response.json();
        toast.show(result.message || 'Your billing issue has been reported successfully');

        // Reset form
        setFormData({
          issueType: 'OTHER',
          description: '',
          severity: 'MEDIUM',
        });

        // Redirect after a short delay
        setTimeout(() => {
          router.push('/billing');
        }, 2000);
      } else {
        throw new Error('Failed to submit billing issue');
      }
    } catch (error) {
      console.error('Error submitting billing issue:', error);
      toast.show('Failed to submit billing issue. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-[16px]">
      <div className="flex items-center gap-4 mb-6">
        <Button onClick={() => router.push('/billing')} className="flex items-center gap-2">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M20 12H4M4 12L10 18M4 12L10 6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Back to Billing
        </Button>
      </div>
      <TopTitle title="Report Billing Issue" />

      <div className="max-w-2xl">
        <div className="bg-sixth border border-customColor6 rounded-lg overflow-hidden">
          <div className="p-6 border-b border-customColor6">
            <h3 className="text-lg font-medium text-textColor">
              Billing Support
            </h3>
            <p className="text-sm text-customColor18 mt-1">
              Report billing issues and submit support requests. Our team will respond within 24 hours.
            </p>
          </div>

          <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-textColor mb-2">
                  Issue Type
                </label>
                <select
                  value={formData.issueType}
                  onChange={(e) => setFormData({ ...formData, issueType: e.target.value as any })}
                  className="w-full px-3 py-2 bg-customColor2 border border-customColor6 rounded-md text-textColor focus:border-customColor9 focus:outline-none"
                >
                  <option value="OTHER">Other</option>
                  <option value="PAYMENT_FAILED">Payment Failed</option>
                  <option value="SERVICE_PROBLEM">Service Problem</option>
                  <option value="ACCOUNT_QUESTION">Account Question</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-textColor mb-2">
                  Severity
                </label>
                <select
                  value={formData.severity}
                  onChange={(e) => setFormData({ ...formData, severity: e.target.value as any })}
                  className="w-full px-3 py-2 bg-customColor2 border border-customColor6 rounded-md text-textColor focus:border-customColor9 focus:outline-none"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-textColor mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Please describe your billing issue in detail..."
                  className="w-full bg-customColor2 border border-customColor6 rounded-md p-3 text-textColor placeholder-customColor18 focus:border-customColor9 focus:outline-none"
                  rows={6}
                />
                <p className="text-xs text-customColor18 mt-1">
                  Include transaction IDs, dates, or any relevant details to help us resolve your issue faster.
                </p>
              </div>

              <div className="flex justify-end gap-4">
                <Button onClick={() => router.push('/billing')}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting} loading={submitting}>
                  Submit Issue
                </Button>
              </div>
            </form>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mt-6">
          <div className="flex items-start gap-3">
            <div className="text-blue-500 text-xl">ℹ️</div>
            <div>
              <h4 className="font-medium text-blue-900 mb-2">
                Response Time
              </h4>
              <p className="text-sm text-blue-700">
                We typically respond to billing issues within 24 hours. For urgent problems, please contact us directly.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mt-4">
          <div className="flex items-start gap-3">
            <div className="text-yellow-500 text-xl">⚡</div>
            <div>
              <h4 className="font-medium text-yellow-900 mb-2">
                Quick Links
              </h4>
              <div className="text-sm text-yellow-700 space-y-2">
                <p>• <button
                    onClick={() => router.push('/billing/transactions')}
                    className="hover:underline text-yellow-800"
                  >
                    View transaction history
                  </button></p>
                <p>• <button
                    onClick={() => router.push('/billing/failed-payments')}
                    className="hover:underline text-yellow-800"
                  >
                    Check failed payments
                  </button></p>
                <p>• <button
                    onClick={() => router.push('/billing')}
                    className="hover:underline text-yellow-800"
                  >
                    Update payment method
                  </button></p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
import React from 'react';
import { PaymentFailureComponent } from '@gitroom/frontend/components/billing/payment.failure.component';

export default function FailedPaymentsPage() {
  return (
    <div className="w-full max-w-6xl mx-auto p-6">
      <PaymentFailureComponent />
    </div>
  );
}
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma/prisma.service';
import { PayPalCustomer, PayPalBillingMessage, PayPalBillingHistory } from '@prisma/client';

@Injectable()
export class PayPalBillingService {
  private readonly logger = new Logger(PayPalBillingService.name);

  constructor(
    private readonly prisma: PrismaService,
  ) {}

  // PayPal Customer Management
  async createOrUpdatePayPalCustomer(
    organizationId: string,
    paypalData: {
      paypalPayerId?: string;
      paypalEmail?: string;
      paypalName?: string;
      currentPlanId?: string;
      subscriptionStatus?: string;
    }
  ): Promise<PayPalCustomer> {
    try {
      // Check if PayPal customer exists, update if so, create if not
      const existingCustomer = await this.prisma.payPalCustomer.findUnique({
        where: { organizationId }
      });

      if (existingCustomer) {
        return await this.prisma.payPalCustomer.update({
          where: { organizationId },
          data: paypalData
        });
      } else {
        return await this.prisma.payPalCustomer.create({
          data: {
            organizationId,
            ...paypalData
          }
        });
      }
    } catch (error) {
      this.logger.error('Error creating/updating PayPal customer:', error);
      throw error;
    }
  }

  async getPayPalCustomer(organizationId: string): Promise<PayPalCustomer | null> {
    try {
      return await this.prisma.payPalCustomer.findUnique({
        where: { organizationId }
      });
    } catch (error) {
      this.logger.error('Error getting PayPal customer:', error);
      return null;
    }
  }

  // Billing Portal Management
  async getBillingPortalData(organizationId: string): Promise<{
    customer: PayPalCustomer | null;
    subscription: any;
    messages: PayPalBillingMessage[];
    history: PayPalBillingHistory[];
  }> {
    try {
      const [customer, subscription, messages, history] = await Promise.all([
        this.prisma.payPalCustomer.findUnique({
          where: { organizationId }
        }),
        this.prisma.subscription.findUnique({
          where: { organizationId },
          include: {
            paymentTransactions: {
              where: { status: 'SUCCEEDED' },
              orderBy: { createdAt: 'desc' },
              take: 5
            }
          }
        }),
        this.prisma.payPalBillingMessage.findMany({
          where: {
            organizationId,
            dismissedAt: null,
            OR: [
              { expiresAt: null },
              { expiresAt: { gt: new Date() } }
            ]
          },
          orderBy: { createdAt: 'desc' }
        }),
        this.prisma.payPalBillingHistory.findMany({
          where: { organizationId },
          orderBy: { createdAt: 'desc' },
          take: 10
        })
      ]);

      return {
        customer,
        subscription,
        messages,
        history
      };
    } catch (error) {
      this.logger.error('Error getting billing portal data:', error);
      throw error;
    }
  }

  // Billing Messages Management
  async createBillingMessage(
    organizationId: string,
    message: {
      type: 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS';
      title: string;
      message: string;
      actionUrl?: string;
      actionLabel?: string;
      expiresAt?: Date;
      isDismissable?: boolean;
    }
  ): Promise<PayPalBillingMessage> {
    try {
      return await this.prisma.payPalBillingMessage.create({
        data: {
          organizationId,
          ...message
        }
      });
    } catch (error) {
      this.logger.error('Error creating billing message:', error);
      throw error;
    }
  }

  async dismissBillingMessage(messageId: string): Promise<void> {
    try {
      await this.prisma.payPalBillingMessage.update({
        where: { id: messageId },
        data: { dismissedAt: new Date() }
      });
    } catch (error) {
      this.logger.error('Error dismissing billing message:', error);
      throw error;
    }
  }

  // Billing History Management
  async logBillingAction(
    organizationId: string,
    action: {
      action: 'SUBSCRIPTION_CREATED' | 'SUBSCRIPTION_UPDATED' | 'SUBSCRIPTION_CANCELLED' |
             'PAYMENT_SUCCEEDED' | 'PAYMENT_FAILED' | 'PLAN_CHANGED' |
             'TRIAL_STARTED' | 'TRIAL_ENDED' | 'RENEWAL_SUCCESS' | 'RENEWAL_FAILED';
      description: string;
      oldValue?: string;
      newValue?: string;
      subscriptionId?: string;
      transactionId?: string;
      metadata?: any;
    }
  ): Promise<PayPalBillingHistory> {
    try {
      return await this.prisma.payPalBillingHistory.create({
        data: {
          organizationId,
          ...action
        }
      });
    } catch (error) {
      this.logger.error('Error logging billing action:', error);
      throw error;
    }
  }

  // Helper method to get customer billing URL
  async getCustomerBillingUrl(organizationId: string): Promise<string> {
    // Return custom billing portal URL for our application
    return `${process.env.FRONTEND_URL}/billing?org=${organizationId}`;
  }

  // Update customer portal preferences
  async updateCustomerPreferences(
    organizationId: string,
    preferences: {
      billingCycle?: string;
      emailNotifications?: boolean;
      autoRenew?: boolean;
      portalEnabled?: boolean;
    }
  ): Promise<PayPalCustomer> {
    try {
      return await this.prisma.payPalCustomer.update({
        where: { organizationId },
        data: preferences
      });
    } catch (error) {
      this.logger.error('Error updating customer preferences:', error);
      throw error;
    }
  }
}
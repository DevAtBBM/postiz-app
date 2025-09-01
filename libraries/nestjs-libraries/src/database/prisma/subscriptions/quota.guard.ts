import { Injectable, CanActivate, ExecutionContext, ForbiddenException, BadRequestException } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';

@Injectable()
export class QuotaGuard implements CanActivate {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const organization = request.organization;

    if (!organization) {
      throw new BadRequestException('No organization found in request');
    }

    try {
      const handler = context.getHandler();
      const className = context.getClass().name;
      const methodName = handler.name;
      const url = request.baseUrl + request.path;

      // Skip quota checks for GET requests and certain endpoints
      if (request.method === 'GET' || this.shouldSkipQuotaCheck(url)) {
        return true;
      }

      // Check post creation endpoints
      if (this.isPostCreationEndpoint(url, request.method)) {
        await this.checkQuota(organization.id, 'posts', request.method);
      }

      // Check AI feature endpoints
      const aiType = this.getAIType(url, request.method);
      if (aiType) {
        await this.checkQuota(organization.id, aiType, request.method);
      }

      return true;
    } catch (error) {
      if (error instanceof Error) {
        throw new ForbiddenException(error.message);
      } else {
        throw new ForbiddenException('Quota check failed');
      }
    }
  }

  private shouldSkipQuotaCheck(url: string): boolean {
    const skipPatterns = [
      '/billing/usage',
      '/admin',
      '/organization/update',
      '/auth'
    ];

    return skipPatterns.some(pattern => url.includes(pattern));
  }

  private isPostCreationEndpoint(url: string, method: string): boolean {
    return (url.includes('/posts') && ['POST', 'PUT'].includes(method)) ||
           (url.includes('/publish') && method === 'POST');
  }

  private getAIType(url: string, method: string): 'ai_images' | 'ai_videos' | null {
    if (method !== 'POST') return null;

    if (url.includes('/ai/') && url.includes('/image')) {
      return 'ai_images';
    }

    if (url.includes('/copilot')) {
      // Determine AI type based on copilot endpoint
      if (url.includes('/image')) return 'ai_images';
      if (url.includes('/video')) return 'ai_videos';
      // Default copilot usage
      return 'ai_images';
    }

    return null;
  }

  private async checkQuota(organizationId: string, feature: string, method: string) {
    // Only check quotas for POST/PUT operations that create/modify resources
    if (method !== 'POST' && method !== 'PUT') {
      return;
    }

    const limits = await this.subscriptionService.checkFeatureLimits(
      organizationId,
      feature as any,
      1
    );

    if (!limits.allowed) {
      throw new Error(`Quota exceeded for ${feature}: ${limits.reason}`);
    }
  }
}
import { Logger, Controller, Get, Post, Req, Res, Query, UseGuards } from '@nestjs/common';
import {
  CopilotRuntime,
  OpenAIAdapter,
  copilotRuntimeNodeHttpEndpoint,
} from '@copilotkit/runtime';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { Organization } from '@prisma/client';
import { SubscriptionService } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/subscription.service';
import { MastraAgent } from '@ag-ui/mastra';
import { MastraService } from '@gitroom/nestjs-libraries/chat/mastra.service';
import { Mastra } from '@mastra/core/dist/mastra';
import { Request, Response } from 'express';
import { RuntimeContext } from '@mastra/core/di';
let mastra: Mastra;

export type ChannelsContext = {
  integrations: string;
  organization: string;
};

@Controller('/copilot')
export class CopilotController {
  constructor(
    private _subscriptionService: SubscriptionService,
    private _mastraService: MastraService
  ) {}
  @Post('/chat')
  //@UseGuards(QuotaGuard)
  async chat(
    @Req() req: Request,
    @Res() res: Response,
    @GetOrgFromRequest() org: Organization
  ): Promise<void> {
    Logger.log(`Copilot chat request received from org: ${org.id}, request body keys: ${Object.keys(req.body || {})}`);
    if (
      process.env.OPENAI_API_KEY === undefined ||
      process.env.OPENAI_API_KEY === ''
    ) {
      Logger.warn('OpenAI API key not set, chat functionality will not work');
      Logger.error('OPENAI_API_KEY environment variable is missing or empty');
      throw new Error('OpenAI API key not configured');
    }
    Logger.log('OpenAI API key is configured, proceeding with request');

    // TEMPORARILY DISABLED: Track AI image usage through subscription service
    // await this._subscriptionService.useFeature(org, 'ai_images', async () => {
    //   const copilotRuntimeHandler = copilotRuntimeNestEndpoint({
    //     endpoint: '/copilot/chat',
    //     runtime: new CopilotRuntime(),
    //     serviceAdapter: new OpenAIAdapter({
    //       model:
    //         // @ts-ignore
    //         req?.body?.variables?.data?.metadata?.requestType ===
    //         'TextareaCompletion'
    //           ? 'gpt-4o-mini'
    //           : 'gpt-4.1',
    //     }),
    //   });

    //   // @ts-ignore
    //   return copilotRuntimeHandler(req, res);
    // });

    const copilotRuntimeHandler = copilotRuntimeNodeHttpEndpoint({
      endpoint: '/copilot/chat',
      runtime: new CopilotRuntime(),
      serviceAdapter: new OpenAIAdapter({
        model: 'gpt-4.1',
      }),
    });

    return copilotRuntimeHandler(req, res);
  }

  @Post('/agent')
  async agent(
    @Req() req: Request,
    @Res() res: Response,
    @GetOrgFromRequest() organization: Organization
  ) {
    if (
      process.env.OPENAI_API_KEY === undefined ||
      process.env.OPENAI_API_KEY === ''
    ) {
      Logger.warn('OpenAI API key not set, chat functionality will not work');
      return;
    }
    mastra = mastra || (await this._mastraService.mastra());
    const runtimeContext = new RuntimeContext<ChannelsContext>();
    runtimeContext.set(
      'integrations',
      req?.body?.variables?.properties?.integrations || []
    );

    runtimeContext.set('organization', organization.id);

    const runtime = new CopilotRuntime({
      agents: MastraAgent.getLocalAgents({
        mastra,
        // @ts-ignore
        runtimeContext,
      }),
    });

    const copilotRuntimeHandler = copilotRuntimeNodeHttpEndpoint({
      endpoint: '/copilot/agent',
      runtime,
      properties: req.body.variables.properties,
      serviceAdapter: new OpenAIAdapter({
        model: 'gpt-4.1',
      }),
    });

    return copilotRuntimeHandler(req, res);
  }

  @Get('/credits')
  calculateCredits(
    @GetOrgFromRequest() organization: Organization,
    @Query('type') type: 'ai_images' | 'ai_videos'
  ) {
    return this._subscriptionService.checkCredits(
      organization,
      type || 'ai_images'
    );
  }
}

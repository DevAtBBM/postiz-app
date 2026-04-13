import { Module } from '@nestjs/common';

import { DatabaseModule } from '@gitroom/nestjs-libraries/database/prisma/database.module';
import { PlugsController } from '@gitroom/workers/app/plugs.controller';
import { SentryModule } from '@sentry/nestjs/setup';
import { FILTER } from '@gitroom/nestjs-libraries/sentry/sentry.exception';

@Module({
  imports: [SentryModule.forRoot(), DatabaseModule],
  controllers: [PlugsController],
  providers: [FILTER],
})
export class AppModule {}

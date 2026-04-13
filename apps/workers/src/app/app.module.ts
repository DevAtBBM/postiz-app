import { Module } from '@nestjs/common';
import { SentryModule } from '@sentry/nestjs/setup';

@Module({
  imports: [SentryModule.forRoot()],
})
export class AppModule {}

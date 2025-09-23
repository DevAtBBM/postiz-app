import { Injectable } from '@nestjs/common';
import { EmailInterface } from '@gitroom/nestjs-libraries/emails/email.interface';
import { ResendProvider } from '@gitroom/nestjs-libraries/emails/resend.provider';
import { EmptyProvider } from '@gitroom/nestjs-libraries/emails/empty.provider';
import { NodeMailerProvider } from '@gitroom/nestjs-libraries/emails/node.mailer.provider';
import { concurrencyService } from '@gitroom/helpers/utils/concurrency.service';

@Injectable()
export class EmailService {
  emailService: EmailInterface;
  constructor() {
    this.emailService = this.selectProvider(process.env.EMAIL_PROVIDER!);
    console.log('Email service provider:', this.emailService.name);
    for (const key of this.emailService.validateEnvKeys) {
      if (!process.env[key]) {
        console.error(`Missing environment variable: ${key}`);
      }
    }
  }

  hasProvider() {
    return !(this.emailService instanceof EmptyProvider);
  }

  selectProvider(provider: string) {
    switch (provider) {
      case 'resend':
        return new ResendProvider();
      case 'nodemailer':
        return new NodeMailerProvider();
      default:
        return new EmptyProvider();
    }
  }

  async sendEmail(to: string, subject: string, html: string, replyTo?: string) {
    if (to.indexOf('@') === -1) {
      return;
    }

    if (!process.env.EMAIL_FROM_ADDRESS || !process.env.EMAIL_FROM_NAME) {
      console.log(
        'Email sender information not found in environment variables'
      );
      return;
    }

    const logoUrl = `${process.env.FRONTEND_URL || 'https://postnify.com'}/img/postnify-logo.svg`;
    const modifiedHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f8f9fa;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8f9fa;">
            <tr>
                <td align="center" style="padding: 40px 20px;">
                    <table width="600" border="0" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden;">
                        <!-- Header with Logo -->
                        <tr>
                            <td style="padding: 40px 40px 20px; background-color: #26b9c0; text-align: center;">
                                <img src="${logoUrl}" alt="Postnify" style="max-width: 150px; height: auto;">
                            </td>
                        </tr>
                        <!-- Content -->
                        <tr>
                            <td style="padding: 40px;">
                                <h1 style="margin: 0 0 24px; font-size: 28px; font-weight: 700; color: #1f2937; text-align: center;">${subject}</h1>
                                <div style="color: #4b5563; font-size: 16px; line-height: 1.6;">
                                    ${html}
                                </div>
                            </td>
                        </tr>
                        <!-- Footer -->
                        <tr>
                            <td style="padding: 20px 40px 40px; background-color: #f8f9fa; text-align: center; border-top: 1px solid #e5e7eb;">
                                <p style="margin: 0; font-size: 14px; color: #6b7280;">
                                    Sent by <strong>${process.env.EMAIL_FROM_NAME || 'Postnify'}</strong><br>
                                    Need help? Contact our support team.
                                </p>
                                <p style="margin: 10px 0 0; font-size: 12px; color: #9ca3af;">
                                    © 2025 Postnify. All rights reserved.
                                </p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    `;

    const sends = await concurrencyService('send-email', () =>
      this.emailService.sendEmail(
        to,
        subject,
        modifiedHtml,
        process.env.EMAIL_FROM_NAME,
        process.env.EMAIL_FROM_ADDRESS,
        replyTo
      )
    );
    console.log(sends);
  }
}

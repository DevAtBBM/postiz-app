import { Injectable } from '@nestjs/common';
import { AgenciesRepository } from '@gitroom/nestjs-libraries/database/prisma/agencies/agencies.repository';
import { User } from '@prisma/client';
import { CreateAgencyDto } from '@gitroom/nestjs-libraries/dtos/agencies/create.agency.dto';
import { NotificationService } from '@gitroom/nestjs-libraries/database/prisma/notifications/notification.service';

@Injectable()
export class AgenciesService {
  constructor(
    private _agenciesRepository: AgenciesRepository,
    private _notificationService: NotificationService
  ) {}
  getAgencyByUser(user: User) {
    return this._agenciesRepository.getAgencyByUser(user);
  }

  getCount() {
    return this._agenciesRepository.getCount();
  }

  getAllAgencies() {
    return this._agenciesRepository.getAllAgencies();
  }

  getAllAgenciesSlug() {
    return this._agenciesRepository.getAllAgenciesSlug();
  }

  getAgencyInformation(agency: string) {
    return this._agenciesRepository.getAgencyInformation(agency);
  }

  async approveOrDecline(email: string, action: string, id: string) {
    await this._agenciesRepository.approveOrDecline(action, id);
    const agency = await this._agenciesRepository.getAgencyById(id);

    if (action === 'approve') {
      const approveHtml = `
        <p>Congratulations! 🎉</p>
        <p>Your agency <strong>${agency?.name}</strong> has been approved and added to the Postnify Agency Network!</p>
        <p>You can now showcase your services to potential clients and start monetizing your content creation expertise.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="https://postnify.com/agencies/${agency?.slug}"
             style="background-color: #26b9c0; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
            View Your Agency Page
          </a>
        </div>
        <p><strong>What's next?</strong></p>
        <ul>
          <li>Your agency profile will appear in the main directory within the next 24 hours</li>
          <li>Update your profile with more details to attract clients</li>
          <li>Share your agency link on social media</li>
          <li>Start receiving inquiries from potential clients</li>
        </ul>
        <p>Welcome to the Postnify community! If you have any questions, feel free to reply to this email.</p>
      `;
      await this._notificationService.sendEmail(
        agency?.user?.email!,
        'Your Agency is Live on Postnify! 🎉',
        approveHtml
      );

      return;
    }

    const declineHtml = `
      <p>Dear ${agency?.name} Team,</p>
      <p>Thank you for your interest in joining the Postnify Agency Network.</p>
      <p>After careful review, we've decided not to approve your agency application at this time. This could be due to various reasons such as:</p>
      <ul>
        <li>Content focus not aligning with our current network</li>
        <li>Quality standards not meeting our requirements</li>
        <li>Other strategic considerations</li>
      </ul>
      <p>We appreciate your understanding and encourage you to continue building your content creation business.</p>
      <p>If you believe this decision was made in error or if you'd like feedback on how to improve your application for future consideration, please reply to this email.</p>
      <p>We wish you the best in your endeavors!</p>
      <p>Best regards,<br>The Postnify Team</p>
    `;
    await this._notificationService.sendEmail(
      agency?.user?.email!,
      'Agency Application Update',
      declineHtml
    );

    return;
  }

  async createAgency(user: User, body: CreateAgencyDto) {
    const agency = await this._agenciesRepository.createAgency(user, body);
    await this._notificationService.sendEmail(
      'nevo@postnify.com',
      'New agency created',
      `
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Email Template</title>
</head>

<body style="font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4;">
    <table align="center" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%; background-color: #ffffff; margin-top: 20px; border: 1px solid #ddd;">
        <tr>
            <td style="padding: 0 20px 20px 20px; text-align: center;">
                <!-- Website -->
                <a href="${
                  body.website
                }" style="text-decoration: none; color: #007bff;">${
        body.website
      }</a>
            </td>
        </tr>
        <tr>
            <td style="padding: 20px; text-align: center;">
                <!-- Social Media Links -->
                <p style="margin: 10px 0; font-size: 16px;">
                    Social Medias:
                    <a href="${
                      body.facebook
                    }" style="margin: 0 10px; text-decoration: none; color: #007bff;">${
        body.facebook
      }</a><br />
                    <a href="${
                      body.instagram
                    }" style="margin: 0 10px; text-decoration: none; color: #007bff;">${
        body.instagram
      }</a><br />
                    <a href="${
                      body.twitter
                    }" style="margin: 0 10px; text-decoration: none; color: #007bff;">${
        body.twitter
      }</a><br />
                    <a href="${
                      body.linkedIn
                    }" style="margin: 0 10px; text-decoration: none; color: #007bff;">${
        body.linkedIn
      }</a><br />
                    <a href="${
                      body.youtube
                    }" style="margin: 0 10px; text-decoration: none; color: #007bff;">${
        body.youtube
      }</a><br />
                    <a href="${
                      body.tiktok
                    }" style="margin: 0 10px; text-decoration: none; color: #007bff;">${
        body.tiktok
      }</a>
                </p>
            </td>
        </tr>
        <tr>
            <td style="padding: 20px;">
                <!-- Short Description -->
                <h2 style="text-align: center; color: #333;">Logo</h2>
                <p style="text-align: center; color: #555; font-size: 16px;">
                  <img src="${body.logo.path}" width="60" height="60" />
                </p>
            </td>
        </tr>
        <tr>
            <td style="padding: 20px;">
                <!-- Short Description -->
                <h2 style="text-align: center; color: #333;">Name</h2>
                <p style="text-align: center; color: #555; font-size: 16px;">${
                  body.name
                }</p>
            </td>
        </tr>
        <tr>
            <td style="padding: 20px;">
                <!-- Short Description -->
                <h2 style="text-align: center; color: #333;">Short Description</h2>
                <p style="text-align: center; color: #555; font-size: 16px;">${
                  body.shortDescription
                }</p>
            </td>
        </tr>
        <tr>
            <td style="padding: 20px;">
                <!-- Description -->
                <h2 style="text-align: center; color: #333;">Description</h2>
                <p style="text-align: center; color: #555; font-size: 16px;">${
                  body.description
                }</p>
            </td>
        </tr>
        <tr>
            <td style="padding: 20px;">
                <!-- Niches -->
                <h2 style="text-align: center; color: #333;">Niches</h2>
                <p style="text-align: center; color: #555; font-size: 16px;">${body.niches.join(
                  ','
                )}</p>
            </td>
        </tr>
        <tr>
            <td style="padding: 20px; text-align: center; background-color: #000;">
                <a href="https://postiz.com/agencies/action/approve/${
                  agency.id
                }" style="margin: 0 10px; text-decoration: none; color: #007bff;">To approve click here</a><br /><br /><br />
                <a href="https://postiz.com/agencies/action/decline/${
                  agency.id
                }" style="margin: 0 10px; text-decoration: none; color: #007bff;">To decline click here</a><br /><br /><br />
            </td>
        </tr>
        <tr>
            <td style="padding: 20px; text-align: center; background-color: #f4f4f4;">
                <p style="color: #777; font-size: 14px;">&copy; 2025 Postnify All rights reserved.</p>
            </td>
        </tr>
    </table>
</body>

</html>
    `
    );
    return agency;
  }
}

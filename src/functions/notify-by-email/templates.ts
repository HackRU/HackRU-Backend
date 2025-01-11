/**
 * Fetches the email template based on the provided status.
 *
 * @param registrationStatus - The status for which to fetch the template (e.g., 'registered', 'confirmation', etc.).
 * @param firstName - The first name of the user to personalize the email body.
 * @param lastName - The last name of the user to personalize the email body.
 * @returns An object containing the email subject and body (both plaintext and html version).
 */
export function getEmailTemplate(
  registrationStatus: keyof typeof EMAIL_TEMPLATES,
  firstName: string,
  lastName: string
): { subject: string; plainTextBody: string; htmlBody: string } {
  const template = EMAIL_TEMPLATES[registrationStatus];

  if (!template) throw new Error(`Invalid status: ${registrationStatus}`);

  return {
    subject: template.subject,
    plainTextBody: template.plainText(firstName, lastName),
    htmlBody: template.html(firstName, lastName),
  };
}

const EMAIL_TEMPLATES = {
  registered: {
    subject: 'HackRU Registration Received',
    plainText: (firstName: string, lastName: string) => `Dear ${firstName} ${lastName},

Thank you for registering for HackRU! Your application has been received and is currently being reviewed by our team. 

We'll notify you once a decision has been made regarding your application.

Best regards,
The HackRU Team`,

    html: (firstName: string, lastName: string) => `
      <html>
        <body>
          <p>Dear ${firstName} ${lastName},</p>
          <p>Thank you for registering for HackRU! Your application has been received and is currently being reviewed by our team.</p>
          <p>We'll notify you once a decision has been made regarding your application.</p>
          <p>Best regards,</p>
          <p><strong>The HackRU Team</strong></p>
        </body>
      </html>
    `,
  },
  confirmation: {
    subject: "Congratulations! You've Been Accepted to HackRU!",
    plainText: (firstName: string, lastName: string) => `Dear ${firstName} ${lastName},

Great news! Your application for HackRU has been accepted! 
Please log in to your HackRU dashboard to confirm whether you will be attending. Update your status to either "coming" or "not coming" so we can properly allocate resources.
We look forward to seeing you at HackRU!

Best regards,
The HackRU Team`,
    html: (firstName: string, lastName: string) => `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.5; color: #333;">
          <p>Dear ${firstName} ${lastName},</p>
          <p>Great news! Your application for HackRU has been accepted!</p>
          <p>Please log in to your HackRU dashboard to confirm whether you will be attending. Update your status to either "coming" or "not coming" so we can properly allocate resources.</p>
          <p>We look forward to seeing you at HackRU!</p>
          <p>Best regards,</p>
          <p><strong>The HackRU Team</strong></p>
        </body>
      </html>
    `,
  },
  rejected: {
    subject: 'HackRU Application Status Update',
    plainText: (firstName: string, lastName: string) => `Dear ${firstName} ${lastName},

Thank you for your interest in HackRU and for taking the time to apply.
After careful consideration, we regret to inform you that we are unable to offer you a spot at this time. We receive many applications and unfortunately cannot accommodate everyone.
We encourage you to apply again for our future events!

Best regards,
The HackRU Team`,
    html: (firstName: string, lastName: string) => `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.5; color: #333;">
          <p>Dear ${firstName} ${lastName},</p>
          <p>Thank you for your interest in HackRU and for taking the time to apply.</p>
          <p>After careful consideration, we regret to inform you that we are unable to offer you a spot at this time. We receive many applications and unfortunately cannot accommodate everyone.</p>
          <p>We encourage you to apply again for our future events!</p>
          <p>Best regards,</p>
          <p><strong>The HackRU Team</strong></p>
        </body>
      </html>
    `,
  },
  waitlist: {
    subject: 'HackRU Application Status - Waitlist',
    plainText: (firstName: string, lastName: string) => `Dear ${firstName} ${lastName},

Thank you for your application to HackRU. Due to the high volume of applications, we've added you to our waitlist.
We'll contact you if a spot becomes available. In the meantime, no further action is required from you.

Best regards,
The HackRU Team`,
    html: (firstName: string, lastName: string) => `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.5; color: #333;">
          <p>Dear ${firstName} ${lastName},</p>
          <p>Thank you for your application to HackRU. Due to the high volume of applications, we've added you to our waitlist.</p>
          <p>We'll contact you if a spot becomes available. In the meantime, no further action is required from you.</p>
          <p>Best regards,</p>
          <p><strong>The HackRU Team</strong></p>
        </body>
      </html>
    `,
  },
};

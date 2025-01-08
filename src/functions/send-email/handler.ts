import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import type { SNSEvent } from 'aws-lambda';

const ses = new SESv2Client({});

interface EmailMessage {
  email: string;
  firstName: string;
  lastName: string;
  registrationStatus: string;
}

// Email templates for the specific registration statuses
const EMAIL_TEMPLATES = {
  registered: {
    subject: 'HackRU Registration Received',
    body: (firstName: string) => `Dear ${firstName},

Thank you for registering for HackRU! Your application has been received and is currently being reviewed by our team. 

We'll notify you once a decision has been made regarding your application.

Best regards,
The HackRU Team`,
  },
  confirmation: {
    subject: "Congratulations! You've Been Accepted to HackRU!",
    body: (firstName: string) => `Dear ${firstName},

Great news! Your application for HackRU has been accepted! 

Please log in to your HackRU dashboard to confirm whether you will be attending. Update your status to either "coming" or "not coming" so we can properly allocate resources.

We look forward to seeing you at HackRU!

Best regards,
The HackRU Team`,
  },
  rejected: {
    subject: 'HackRU Application Status Update',
    body: (firstName: string) => `Dear ${firstName},

Thank you for your interest in HackRU and for taking the time to apply.

After careful consideration, we regret to inform you that we are unable to offer you a spot at this time. We receive many applications and unfortunately cannot accommodate everyone.

We encourage you to apply again for our future events!

Best regards,
The HackRU Team`,
  },
  waitlist: {
    subject: 'HackRU Application Status - Waitlist',
    body: (firstName: string) => `Dear ${firstName},

Thank you for your application to HackRU. Due to the high volume of applications, we've added you to our waitlist.

We'll contact you if a spot becomes available. In the meantime, no further action is required from you.

Best regards,
The HackRU Team`,
  },
};

export const handler = async (event: SNSEvent) => {
  try {
    for (const record of event.Records) {
      const message: EmailMessage = JSON.parse(record.Sns.Message);
      const { email, firstName, registrationStatus } = message;

      const template = EMAIL_TEMPLATES[registrationStatus as keyof typeof EMAIL_TEMPLATES];

      // status not in list of statuses yet: registered, confirmation, rejected, waitlisted
      if (!template) {
        console.log(`No email template for status: ${registrationStatus}`);
        continue;
      }

      // Email construction
      const params = {
        FromEmailAddress: process.env.SENDER_EMAIL,
        Destination: {
          ToAddresses: [email],
        },
        Content: {
          Simple: {
            Subject: {
              Data: template.subject,
              Charset: 'UTF-8',
            },
            Body: {
              Text: {
                Data: template.body(firstName),
                Charset: 'UTF-8',
              },
            },
          },
        },
      };

      // Sending Email
      const command = new SendEmailCommand(params);
      await ses.send(command);
      console.log(`Email sent to ${email} for status: ${registrationStatus}`);
    }

    // Success
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Emails processed successfully' }),
    };
  } catch (error) {
    console.error('Error sending email:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error processing emails',
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};

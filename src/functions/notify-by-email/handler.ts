import type { SNSEvent } from 'aws-lambda';
import { getEmailTemplate } from './templates';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';

const notifyByEmail = async (event: SNSEvent) => {
  try {
    for (const record of event.Records) {
      const message = JSON.parse(record.Sns.Message);
      // eslint-disable-next-line @typescript-eslint/naming-convention
      const { email, first_name, last_name, registration_status } = message;

      // Determine email subject and body based on registration_status
      const template = getEmailTemplate(registration_status, first_name, last_name);
      const ses = new SESv2Client({});
      const params = {
        FromEmailAddress: 'no-reply@hackru.org',
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
                Data: template.plainTextBody,
                Charset: 'UTF-8',
              },
              Html: {
                Data: template.htmlBody,
              },
            },
          },
        },
      };

      // Sending Email
      const command = new SendEmailCommand(params);
      await ses.send(command);
      console.log('Email notifying change of registration status is sent successfully.');
    }
  } catch (error) {
    console.error('Error notifying users by email', error);
  }
};

export const main = notifyByEmail;

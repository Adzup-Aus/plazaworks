// Resend Email Integration
// Uses Replit's secure connection management for API keys

import { Resend } from 'resend';

let connectionSettings: any;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=resend',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || (!connectionSettings.settings.api_key)) {
    throw new Error('Resend not connected');
  }
  return { apiKey: connectionSettings.settings.api_key, fromEmail: connectionSettings.settings.from_email };
}

// WARNING: Never cache this client.
// Access tokens expire, so a new client must be created each time.
export async function getResendClient() {
  const { apiKey, fromEmail } = await getCredentials();
  return {
    client: new Resend(apiKey),
    fromEmail
  };
}

// Email sending utilities
export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(options: EmailOptions) {
  const { client, fromEmail } = await getResendClient();
  
  const result = await client.emails.send({
    from: fromEmail,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text,
  });
  
  return result;
}

// Pre-built email templates
export async function sendQuoteNotification(clientEmail: string, clientName: string, quoteNumber: string, quoteTotal: string, portalUrl: string) {
  return sendEmail({
    to: clientEmail,
    subject: `New Quote #${quoteNumber} Ready for Review`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Hello ${clientName},</h2>
        <p>A new quote has been prepared for you.</p>
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Quote Number:</strong> ${quoteNumber}</p>
          <p><strong>Total:</strong> ${quoteTotal}</p>
        </div>
        <p>You can review and approve this quote through your client portal:</p>
        <a href="${portalUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0;">View Quote</a>
        <p style="color: #666; font-size: 14px; margin-top: 30px;">If you have any questions, please don't hesitate to contact us.</p>
      </div>
    `,
    text: `Hello ${clientName}, A new quote #${quoteNumber} for ${quoteTotal} is ready for review. View it at: ${portalUrl}`,
  });
}

export async function sendInvoiceNotification(clientEmail: string, clientName: string, invoiceNumber: string, invoiceTotal: string, dueDate: string, portalUrl: string) {
  return sendEmail({
    to: clientEmail,
    subject: `Invoice #${invoiceNumber} - Payment Due ${dueDate}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Hello ${clientName},</h2>
        <p>An invoice has been issued for your recent work.</p>
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Invoice Number:</strong> ${invoiceNumber}</p>
          <p><strong>Amount Due:</strong> ${invoiceTotal}</p>
          <p><strong>Due Date:</strong> ${dueDate}</p>
        </div>
        <p>You can view and pay this invoice through your client portal:</p>
        <a href="${portalUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0;">View Invoice</a>
        <p style="color: #666; font-size: 14px; margin-top: 30px;">Thank you for your business!</p>
      </div>
    `,
    text: `Hello ${clientName}, Invoice #${invoiceNumber} for ${invoiceTotal} is due on ${dueDate}. View it at: ${portalUrl}`,
  });
}

export async function sendOtpEmail(email: string, otp: string) {
  return sendEmail({
    to: email,
    subject: 'Your Login Code',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Your Login Code</h2>
        <p>Use the following code to log in to your account:</p>
        <div style="background: #f5f5f5; padding: 30px; border-radius: 8px; margin: 20px 0; text-align: center;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px;">${otp}</span>
        </div>
        <p style="color: #666; font-size: 14px;">This code will expire in 10 minutes.</p>
        <p style="color: #666; font-size: 14px;">If you didn't request this code, please ignore this email.</p>
      </div>
    `,
    text: `Your login code is: ${otp}. This code will expire in 10 minutes.`,
  });
}

export async function sendJobCompletionNotification(clientEmail: string, clientName: string, jobTitle: string, completionDate: string) {
  return sendEmail({
    to: clientEmail,
    subject: `Job Completed: ${jobTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Hello ${clientName},</h2>
        <p>Great news! Your job has been completed.</p>
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Job:</strong> ${jobTitle}</p>
          <p><strong>Completed On:</strong> ${completionDate}</p>
        </div>
        <p>Thank you for choosing us. We hope you're satisfied with our work!</p>
        <p style="color: #666; font-size: 14px; margin-top: 30px;">If you have any questions or feedback, please don't hesitate to reach out.</p>
      </div>
    `,
    text: `Hello ${clientName}, Your job "${jobTitle}" was completed on ${completionDate}. Thank you for choosing us!`,
  });
}

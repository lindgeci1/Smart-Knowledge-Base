using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;

namespace SmartKB.Services
{
    public class EmailService
    {
        private readonly string _smtpServer;
        private readonly int _smtpPort;
        private readonly string _smtpUsername;
        private readonly string _smtpPassword;
        private readonly string _fromEmail;
        private readonly string _fromName;

        public EmailService(IConfiguration config)
        {
            _smtpServer = Environment.GetEnvironmentVariable("SMTP_SERVER")
                ?? config["SmtpSettings:Server"]
                ?? "smtp.gmail.com";
            
            var portStr = Environment.GetEnvironmentVariable("SMTP_PORT")
                ?? config["SmtpSettings:Port"]
                ?? "587";
            _smtpPort = int.Parse(portStr);
            
            _smtpUsername = Environment.GetEnvironmentVariable("SMTP_USERNAME")
                ?? config["SmtpSettings:Username"]
                ?? throw new Exception("SMTP_USERNAME not configured");
            
            _smtpPassword = Environment.GetEnvironmentVariable("SMTP_PASSWORD")
                ?? config["SmtpSettings:Password"]
                ?? throw new Exception("SMTP_PASSWORD not configured");
            
            _fromEmail = Environment.GetEnvironmentVariable("SMTP_FROM_EMAIL")
                ?? config["SmtpSettings:FromEmail"]
                ?? _smtpUsername;
            
            _fromName = Environment.GetEnvironmentVariable("SMTP_FROM_NAME")
                ?? config["SmtpSettings:FromName"]
                ?? "Smart Knowledge Base";
        }

        public async Task SendPasswordResetEmailAsync(string toEmail, string resetCode)
        {
            try
            {
                var message = new MimeMessage();
                message.From.Add(new MailboxAddress(_fromName, _fromEmail));
                message.To.Add(new MailboxAddress(string.Empty, toEmail));
                message.Subject = "Reset Your Password";

                var bodyBuilder = new BodyBuilder
                {
                    HtmlBody = $@"
                        <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background-color: #ffffff;'>
                            <h1 style='color: #1f2937; font-size: 28px; font-weight: bold; margin: 0 0 24px 0; text-align: left;'>Reset Your Password</h1>
                            <p style='color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;'>Hi,</p>
                            <p style='color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 32px 0;'>You requested to reset your password for your Smart Knowledge Base account. If you didn't request a new password, you can safely delete this email.</p>
                            <p style='color: #6b7280; font-size: 14px; line-height: 1.6; margin: 32px 0 0 0;'>Your reset code is: <strong style='color: #1f2937; font-size: 18px; letter-spacing: 2px;'>{resetCode}</strong></p>
                            <p style='color: #6b7280; font-size: 14px; line-height: 1.6; margin: 8px 0 0 0;'>This code will expire in 5 minutes.</p>
                            <p style='color: #9ca3af; font-size: 14px; line-height: 1.6; margin: 40px 0 0 0;'>The {_fromName} Team.</p>
                        </div>",
                    TextBody = $"Reset Your Password\n\nHi,\n\nYou requested to reset your password for your Smart Knowledge Base account. If you didn't request a new password, you can safely delete this email.\n\nYour reset code is: {resetCode}\nThis code will expire in 5 minutes.\n\nThe {_fromName} Team."
                };

                message.Body = bodyBuilder.ToMessageBody();

                using var client = new SmtpClient();
                await client.ConnectAsync(_smtpServer, _smtpPort, SecureSocketOptions.SslOnConnect);
                await client.AuthenticateAsync(_smtpUsername, _smtpPassword);
                await client.SendAsync(message);
                await client.DisconnectAsync(true);
            }
            catch (Exception ex)
            {
                throw new Exception("Failed to send email. Please try again later.");
            }
        }

        public async Task SendWelcomeEmailAsync(string toEmail, string username)
        {
            try
            {
                var message = new MimeMessage();
                message.From.Add(new MailboxAddress(_fromName, _fromEmail));
                message.To.Add(new MailboxAddress("", toEmail));
                message.Subject = "Welcome to Smart Knowledge Base";

                var frontendUrl = Environment.GetEnvironmentVariable("FRONTEND_URL") ?? "http://localhost:5173";
                var loginLink = $"{frontendUrl}/login";

                var bodyBuilder = new BodyBuilder
                {
                    HtmlBody = $@"
                        <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background-color: #ffffff;'>
                            <h1 style='color: #1f2937; font-size: 28px; font-weight: bold; margin: 0 0 24px 0; text-align: left;'>Welcome to Smart Knowledge Base</h1>
                            <p style='color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;'>Hi {username},</p>
                            <p style='color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 32px 0;'>Thank you for joining Smart Knowledge Base! Your account has been successfully created. You can now start using our AI-powered summarization features to make your work more efficient.</p>
                            <div style='text-align: center; margin: 32px 0;'>
                                <a href='{loginLink}' style='display: inline-block; background-color: #6A5ACD; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-size: 16px; font-weight: 500;'>Get Started</a>
                            </div>
                            <p style='color: #6b7280; font-size: 14px; line-height: 1.6; margin: 24px 0 0 0;'>If that doesn't work, copy and paste the following link in your browser:</p>
                            <p style='color: #2563eb; font-size: 14px; line-height: 1.6; margin: 8px 0 32px 0; word-break: break-all;'><a href='{loginLink}' style='color: #2563eb; text-decoration: underline;'>{loginLink}</a></p>
                            <p style='color: #9ca3af; font-size: 14px; line-height: 1.6; margin: 40px 0 0 0;'>The {_fromName} Team.</p>
                        </div>",
                    TextBody = $"Welcome to Smart Knowledge Base\n\nHi {username},\n\nThank you for joining Smart Knowledge Base! Your account has been successfully created. You can now start using our AI-powered summarization features.\n\nGet Started: {loginLink}\n\nThe {_fromName} Team."
                };

                message.Body = bodyBuilder.ToMessageBody();

                using var client = new SmtpClient();
                await client.ConnectAsync(_smtpServer, _smtpPort, SecureSocketOptions.SslOnConnect);
                await client.AuthenticateAsync(_smtpUsername, _smtpPassword);
                await client.SendAsync(message);
                await client.DisconnectAsync(true);
            }
            catch (Exception ex)
            {
                throw new Exception("Failed to send email. Please try again later.");
            }
        }

        public async Task SendPasswordChangedEmailAsync(string toEmail, string username)
        {
            try
            {
                var message = new MimeMessage();
                message.From.Add(new MailboxAddress(_fromName, _fromEmail));
                message.To.Add(new MailboxAddress("", toEmail));
                message.Subject = "Password Changed Successfully";

                var bodyBuilder = new BodyBuilder
                {
                    HtmlBody = $@"
                        <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background-color: #ffffff;'>
                            <h1 style='color: #1f2937; font-size: 28px; font-weight: bold; margin: 0 0 24px 0; text-align: left;'>Password Changed Successfully</h1>
                            <p style='color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;'>Hi {username},</p>
                            <p style='color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 32px 0;'>This email confirms that your password has been successfully changed for your Smart Knowledge Base account. If you did not make this change, please contact our support team immediately to secure your account.</p>
                            <p style='color: #9ca3af; font-size: 14px; line-height: 1.6; margin: 40px 0 0 0;'>The {_fromName} Team.</p>
                        </div>",
                    TextBody = $"Password Changed Successfully\n\nHi {username},\n\nThis email confirms that your password has been successfully changed for your Smart Knowledge Base account. If you did not make this change, please contact our support team immediately to secure your account.\n\nThe {_fromName} Team."
                };

                message.Body = bodyBuilder.ToMessageBody();

                using var client = new SmtpClient();
                await client.ConnectAsync(_smtpServer, _smtpPort, SecureSocketOptions.SslOnConnect);
                await client.AuthenticateAsync(_smtpUsername, _smtpPassword);
                await client.SendAsync(message);
                await client.DisconnectAsync(true);
            }
            catch (Exception ex)
            {
                throw new Exception("Failed to send email. Please try again later.");
            }
        }

        public async Task SendPaymentConfirmationEmailAsync(string toEmail, string customerName, string packageName, decimal amount, string currency, string paymentId, DateTime paidAt)
        {
            try
            {
                var message = new MimeMessage();
                message.From.Add(new MailboxAddress(_fromName, _fromEmail));
                message.To.Add(new MailboxAddress("", toEmail));
                message.Subject = "Payment Confirmation";

                var formattedAmount = amount.ToString("F2");
                var formattedDate = paidAt.ToString("MMMM dd, yyyy 'at' HH:mm UTC");

                var bodyBuilder = new BodyBuilder
                {
                    HtmlBody = $@"
                        <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background-color: #ffffff;'>
                            <h1 style='color: #1f2937; font-size: 28px; font-weight: bold; margin: 0 0 24px 0; text-align: left;'>Payment Confirmation</h1>
                            <p style='color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;'>Hi {customerName},</p>
                            <p style='color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 32px 0;'>Thank you for your purchase! Your payment has been successfully processed. Your package has been activated and is ready to use.</p>
                            <div style='background-color: #f9fafb; padding: 20px; margin: 32px 0; border-radius: 6px; border: 1px solid #e5e7eb;'>
                                <table style='width: 100%; border-collapse: collapse;'>
                                    <tr>
                                        <td style='padding: 8px 0; color: #6b7280; font-size: 14px;'>Package:</td>
                                        <td style='padding: 8px 0; color: #1f2937; font-size: 14px; font-weight: 600; text-align: right;'>{packageName}</td>
                                    </tr>
                                    <tr>
                                        <td style='padding: 8px 0; color: #6b7280; font-size: 14px;'>Amount:</td>
                                        <td style='padding: 8px 0; color: #1f2937; font-size: 14px; font-weight: 600; text-align: right;'>{currency} {formattedAmount}</td>
                                    </tr>
                                    <tr>
                                        <td style='padding: 8px 0; color: #6b7280; font-size: 14px;'>Payment Date:</td>
                                        <td style='padding: 8px 0; color: #1f2937; font-size: 14px; text-align: right;'>{formattedDate}</td>
                                    </tr>
                                    <tr>
                                        <td style='padding: 8px 0; color: #6b7280; font-size: 14px;'>Payment ID:</td>
                                        <td style='padding: 8px 0; color: #1f2937; font-size: 12px; text-align: right; font-family: monospace;'>{paymentId}</td>
                                    </tr>
                                </table>
                            </div>
                            <p style='color: #9ca3af; font-size: 14px; line-height: 1.6; margin: 40px 0 0 0;'>The {_fromName} Team.</p>
                        </div>",
                    TextBody = $"Payment Confirmation\n\nHi {customerName},\n\nThank you for your purchase! Your payment has been successfully processed. Your package has been activated and is ready to use.\n\nPayment Details:\nPackage: {packageName}\nAmount: {currency} {formattedAmount}\nPayment Date: {formattedDate}\nPayment ID: {paymentId}\n\nThe {_fromName} Team."
                };

                message.Body = bodyBuilder.ToMessageBody();

                using var client = new SmtpClient();
                await client.ConnectAsync(_smtpServer, _smtpPort, SecureSocketOptions.SslOnConnect);
                await client.AuthenticateAsync(_smtpUsername, _smtpPassword);
                await client.SendAsync(message);
                await client.DisconnectAsync(true);
            }
            catch (Exception ex)
            {
                throw new Exception("Failed to send email. Please try again later.");
            }
        }

        public async Task SendPaymentFailedEmailAsync(string toEmail, string customerName, string packageName, decimal amount, string currency, string paymentId, string? declineReason)
        {
            try
            {
                var message = new MimeMessage();
                message.From.Add(new MailboxAddress(_fromName, _fromEmail));
                message.To.Add(new MailboxAddress("", toEmail));
                message.Subject = "Payment Failed";

                var formattedAmount = amount.ToString("F2");
                var reasonLine = string.IsNullOrWhiteSpace(declineReason)
                    ? "No specific decline reason was provided."
                    : declineReason;

                var bodyBuilder = new BodyBuilder
                {
                    HtmlBody = $@"
                        <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background-color: #ffffff;'>
                            <h1 style='color: #1f2937; font-size: 28px; font-weight: bold; margin: 0 0 24px 0; text-align: left;'>Payment Failed</h1>
                            <p style='color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;'>Hi {customerName},</p>
                            <p style='color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;'>We couldn't process your payment. Please try again or use a different card.</p>
                            <div style='background-color: #f9fafb; padding: 20px; margin: 24px 0; border-radius: 6px; border: 1px solid #e5e7eb;'>
                                <table style='width: 100%; border-collapse: collapse;'>
                                    <tr>
                                        <td style='padding: 6px 0; color: #6b7280; font-size: 14px;'>Package:</td>
                                        <td style='padding: 6px 0; color: #1f2937; font-size: 14px; font-weight: 600; text-align: right;'>{packageName}</td>
                                    </tr>
                                    <tr>
                                        <td style='padding: 6px 0; color: #6b7280; font-size: 14px;'>Amount:</td>
                                        <td style='padding: 6px 0; color: #1f2937; font-size: 14px; font-weight: 600; text-align: right;'>{currency} {formattedAmount}</td>
                                    </tr>
                                    <tr>
                                        <td style='padding: 6px 0; color: #6b7280; font-size: 14px;'>Payment ID:</td>
                                        <td style='padding: 6px 0; color: #1f2937; font-size: 12px; text-align: right; font-family: monospace;'>{paymentId}</td>
                                    </tr>
                                    <tr>
                                        <td style='padding: 6px 0; color: #6b7280; font-size: 14px;'>Decline Reason:</td>
                                        <td style='padding: 6px 0; color: #1f2937; font-size: 14px; text-align: right;'>{reasonLine}</td>
                                    </tr>
                                </table>
                            </div>
                            <p style='color: #9ca3af; font-size: 14px; line-height: 1.6; margin: 40px 0 0 0;'>The {_fromName} Team.</p>
                        </div>",
                    TextBody = $"Payment Failed\n\nHi {customerName},\n\nWe couldn't process your payment. Please try again or use a different card.\n\nPayment Details:\nPackage: {packageName}\nAmount: {currency} {formattedAmount}\nPayment ID: {paymentId}\nDecline Reason: {reasonLine}\n\nThe {_fromName} Team."
                };

                message.Body = bodyBuilder.ToMessageBody();

                using var client = new SmtpClient();
                await client.ConnectAsync(_smtpServer, _smtpPort, SecureSocketOptions.SslOnConnect);
                await client.AuthenticateAsync(_smtpUsername, _smtpPassword);
                await client.SendAsync(message);
                await client.DisconnectAsync(true);
            }
            catch (Exception ex)
            {
                throw new Exception("Failed to send email. Please try again later.");
            }
        }

        public async Task SendPaymentIncompleteEmailAsync(string toEmail, string customerName, string packageName, decimal amount, string currency, string paymentId)
        {
            try
            {
                var message = new MimeMessage();
                message.From.Add(new MailboxAddress(_fromName, _fromEmail));
                message.To.Add(new MailboxAddress("", toEmail));
                message.Subject = "Payment Not Completed";

                var formattedAmount = amount.ToString("F2");

                var bodyBuilder = new BodyBuilder
                {
                    HtmlBody = $@"
                        <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background-color: #ffffff;'>
                            <h1 style='color: #1f2937; font-size: 28px; font-weight: bold; margin: 0 0 24px 0; text-align: left;'>Payment Not Completed</h1>
                            <p style='color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;'>Hi {customerName},</p>
                            <p style='color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;'>Your payment was not completed. Please try again to finish your purchase.</p>
                            <div style='background-color: #f9fafb; padding: 20px; margin: 24px 0; border-radius: 6px; border: 1px solid #e5e7eb;'>
                                <table style='width: 100%; border-collapse: collapse;'>
                                    <tr>
                                        <td style='padding: 6px 0; color: #6b7280; font-size: 14px;'>Package:</td>
                                        <td style='padding: 6px 0; color: #1f2937; font-size: 14px; font-weight: 600; text-align: right;'>{packageName}</td>
                                    </tr>
                                    <tr>
                                        <td style='padding: 6px 0; color: #6b7280; font-size: 14px;'>Amount:</td>
                                        <td style='padding: 6px 0; color: #1f2937; font-size: 14px; font-weight: 600; text-align: right;'>{currency} {formattedAmount}</td>
                                    </tr>
                                    <tr>
                                        <td style='padding: 6px 0; color: #6b7280; font-size: 14px;'>Payment ID:</td>
                                        <td style='padding: 6px 0; color: #1f2937; font-size: 12px; text-align: right; font-family: monospace;'>{paymentId}</td>
                                    </tr>
                                </table>
                            </div>
                            <p style='color: #9ca3af; font-size: 14px; line-height: 1.6; margin: 40px 0 0 0;'>The {_fromName} Team.</p>
                        </div>",
                    TextBody = $"Payment Not Completed\n\nHi {customerName},\n\nYour payment was not completed. Please try again to finish your purchase.\n\nPayment Details:\nPackage: {packageName}\nAmount: {currency} {formattedAmount}\nPayment ID: {paymentId}\n\nThe {_fromName} Team."
                };

                message.Body = bodyBuilder.ToMessageBody();

                using var client = new SmtpClient();
                await client.ConnectAsync(_smtpServer, _smtpPort, SecureSocketOptions.StartTls);
                await client.AuthenticateAsync(_smtpUsername, _smtpPassword);
                await client.SendAsync(message);
                await client.DisconnectAsync(true);
            }
            catch (Exception ex)
            {
                throw new Exception("Failed to send email. Please try again later.");
            }
        }

        public async Task SendPaymentRefundedEmailAsync(string toEmail, string customerName, string packageName, decimal amount, string currency, string paymentId, DateTime refundedAt)
        {
            try
            {
                var message = new MimeMessage();
                message.From.Add(new MailboxAddress(_fromName, _fromEmail));
                message.To.Add(new MailboxAddress("", toEmail));
                message.Subject = "Payment Refunded";

                var formattedAmount = amount.ToString("F2");
                var formattedDate = refundedAt.ToString("MMMM dd, yyyy 'at' HH:mm UTC");

                var bodyBuilder = new BodyBuilder
                {
                    HtmlBody = $@"
                        <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background-color: #ffffff;'>
                            <h1 style='color: #1f2937; font-size: 28px; font-weight: bold; margin: 0 0 24px 0; text-align: left;'>Payment Refunded</h1>
                            <p style='color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;'>Hi {customerName},</p>
                            <p style='color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;'>Your payment has been refunded.</p>
                            <div style='background-color: #f9fafb; padding: 20px; margin: 24px 0; border-radius: 6px; border: 1px solid #e5e7eb;'>
                                <table style='width: 100%; border-collapse: collapse;'>
                                    <tr>
                                        <td style='padding: 6px 0; color: #6b7280; font-size: 14px;'>Package:</td>
                                        <td style='padding: 6px 0; color: #1f2937; font-size: 14px; font-weight: 600; text-align: right;'>{packageName}</td>
                                    </tr>
                                    <tr>
                                        <td style='padding: 6px 0; color: #6b7280; font-size: 14px;'>Amount:</td>
                                        <td style='padding: 6px 0; color: #1f2937; font-size: 14px; font-weight: 600; text-align: right;'>{currency} {formattedAmount}</td>
                                    </tr>
                                    <tr>
                                        <td style='padding: 6px 0; color: #6b7280; font-size: 14px;'>Refund Date:</td>
                                        <td style='padding: 6px 0; color: #1f2937; font-size: 14px; text-align: right;'>{formattedDate}</td>
                                    </tr>
                                    <tr>
                                        <td style='padding: 6px 0; color: #6b7280; font-size: 14px;'>Payment ID:</td>
                                        <td style='padding: 6px 0; color: #1f2937; font-size: 12px; text-align: right; font-family: monospace;'>{paymentId}</td>
                                    </tr>
                                </table>
                            </div>
                            <p style='color: #9ca3af; font-size: 14px; line-height: 1.6; margin: 40px 0 0 0;'>The {_fromName} Team.</p>
                        </div>",
                    TextBody = $"Payment Refunded\n\nHi {customerName},\n\nYour payment has been refunded.\n\nPayment Details:\nPackage: {packageName}\nAmount: {currency} {formattedAmount}\nRefund Date: {formattedDate}\nPayment ID: {paymentId}\n\nThe {_fromName} Team."
                };

                message.Body = bodyBuilder.ToMessageBody();

                using var client = new SmtpClient();
                await client.ConnectAsync(_smtpServer, _smtpPort, SecureSocketOptions.StartTls);
                await client.AuthenticateAsync(_smtpUsername, _smtpPassword);
                await client.SendAsync(message);
                await client.DisconnectAsync(true);
            }
            catch (Exception ex)
            {
                throw new Exception("Failed to send email. Please try again later.");
            }
        }
    }
}



using SendGrid;
using SendGrid.Helpers.Mail;

namespace SmartKB.Services
{
    public class EmailService
    {
        private readonly SendGridClient _sendGridClient;
        private readonly string _fromEmail;
        private readonly string _fromName;

        public EmailService(IConfiguration config)
        {
            var apiKey = Environment.GetEnvironmentVariable("SENDGRID_API_KEY")
                ?? config["SendGrid:ApiKey"]
                ?? throw new Exception("SENDGRID_API_KEY not configured");

            _sendGridClient = new SendGridClient(apiKey);

            _fromEmail = Environment.GetEnvironmentVariable("SMTP_FROM_EMAIL")
                ?? config["SendGrid:FromEmail"]
                ?? throw new Exception("SMTP_FROM_EMAIL not configured");

            _fromName = Environment.GetEnvironmentVariable("SMTP_FROM_NAME")
                ?? config["SendGrid:FromName"]
                ?? "Smart Knowledge Base";
        }

        private async Task SendEmailAsync(string toEmail, string subject, string textBody, string htmlBody)
        {
            var from = new EmailAddress(_fromEmail, _fromName);
            var to = new EmailAddress(toEmail);
            var message = MailHelper.CreateSingleEmail(from, to, subject, textBody, htmlBody);

            var response = await _sendGridClient.SendEmailAsync(message);
            if ((int)response.StatusCode >= 400)
            {
                var errorBody = await response.Body.ReadAsStringAsync();
                throw new Exception($"SendGrid send failed: {response.StatusCode} {errorBody}");
            }
        }

        public async Task SendPasswordResetEmailAsync(string toEmail, string resetCode)
        {
            var subject = "Reset Your Password";
            var htmlBody = $@"
                        <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background-color: #ffffff;'>
                            <h1 style='color: #1f2937; font-size: 28px; font-weight: bold; margin: 0 0 24px 0; text-align: left;'>Reset Your Password</h1>
                            <p style='color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;'>Hi,</p>
                            <p style='color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 32px 0;'>You requested to reset your password for your Smart Knowledge Base account. If you didn't request a new password, you can safely delete this email.</p>
                            <p style='color: #6b7280; font-size: 14px; line-height: 1.6; margin: 32px 0 0 0;'>Your reset code is: <strong style='color: #1f2937; font-size: 18px; letter-spacing: 2px;'>{resetCode}</strong></p>
                            <p style='color: #6b7280; font-size: 14px; line-height: 1.6; margin: 8px 0 0 0;'>This code will expire in 5 minutes.</p>
                            <p style='color: #9ca3af; font-size: 14px; line-height: 1.6; margin: 40px 0 0 0;'>The {_fromName} Team.</p>
                        </div>";
            var textBody =
                $"Reset Your Password\n\nHi,\n\nYou requested to reset your password for your Smart Knowledge Base account. If you didn't request a new password, you can safely delete this email.\n\nYour reset code is: {resetCode}\nThis code will expire in 5 minutes.\n\nThe {_fromName} Team.";

            await SendEmailAsync(toEmail, subject, textBody, htmlBody);
        }

        public async Task SendWelcomeEmailAsync(string toEmail, string username)
        {
            var subject = "Welcome to Smart Knowledge Base";
            var frontendUrl = Environment.GetEnvironmentVariable("FRONTEND_URL") ?? "http://localhost:5173";
            var loginLink = $"{frontendUrl}/login";

            var htmlBody = $@"
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
                        </div>";
            var textBody =
                $"Welcome to Smart Knowledge Base\n\nHi {username},\n\nThank you for joining Smart Knowledge Base! Your account has been successfully created. You can now start using our AI-powered summarization features.\n\nGet Started: {loginLink}\n\nThe {_fromName} Team.";

            await SendEmailAsync(toEmail, subject, textBody, htmlBody);
        }

        public async Task SendPasswordChangedEmailAsync(string toEmail, string username)
        {
            var subject = "Password Changed Successfully";
            var htmlBody = $@"
                        <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background-color: #ffffff;'>
                            <h1 style='color: #1f2937; font-size: 28px; font-weight: bold; margin: 0 0 24px 0; text-align: left;'>Password Changed Successfully</h1>
                            <p style='color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;'>Hi {username},</p>
                            <p style='color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 32px 0;'>This email confirms that your password has been successfully changed for your Smart Knowledge Base account. If you did not make this change, please contact our support team immediately to secure your account.</p>
                            <p style='color: #9ca3af; font-size: 14px; line-height: 1.6; margin: 40px 0 0 0;'>The {_fromName} Team.</p>
                        </div>";
            var textBody =
                $"Password Changed Successfully\n\nHi {username},\n\nThis email confirms that your password has been successfully changed for your Smart Knowledge Base account. If you did not make this change, please contact our support team immediately to secure your account.\n\nThe {_fromName} Team.";

            await SendEmailAsync(toEmail, subject, textBody, htmlBody);
        }

        public async Task SendPaymentConfirmationEmailAsync(string toEmail, string customerName, string packageName, decimal amount, string currency, string paymentId, DateTime paidAt)
        {
            var subject = "Payment Confirmation";
            var formattedAmount = amount.ToString("F2");
            var formattedDate = paidAt.ToString("MMMM dd, yyyy 'at' HH:mm UTC");

            var htmlBody = $@"
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
                        </div>";
            var textBody =
                $"Payment Confirmation\n\nHi {customerName},\n\nThank you for your purchase! Your payment has been successfully processed. Your package has been activated and is ready to use.\n\nPayment Details:\nPackage: {packageName}\nAmount: {currency} {formattedAmount}\nPayment Date: {formattedDate}\nPayment ID: {paymentId}\n\nThe {_fromName} Team.";

            await SendEmailAsync(toEmail, subject, textBody, htmlBody);
        }

        public async Task SendPaymentFailedEmailAsync(string toEmail, string customerName, string packageName, decimal amount, string currency, string paymentId, string? declineReason)
        {
            var subject = "Payment Failed";
            var formattedAmount = amount.ToString("F2");
            var reasonLine = string.IsNullOrWhiteSpace(declineReason)
                ? "No specific decline reason was provided."
                : declineReason;

            var htmlBody = $@"
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
                        </div>";
            var textBody =
                $"Payment Failed\n\nHi {customerName},\n\nWe couldn't process your payment. Please try again or use a different card.\n\nPayment Details:\nPackage: {packageName}\nAmount: {currency} {formattedAmount}\nPayment ID: {paymentId}\nDecline Reason: {reasonLine}\n\nThe {_fromName} Team.";

            await SendEmailAsync(toEmail, subject, textBody, htmlBody);
        }

        public async Task SendPaymentIncompleteEmailAsync(string toEmail, string customerName, string packageName, decimal amount, string currency, string paymentId)
        {
            var subject = "Payment Not Completed";
            var formattedAmount = amount.ToString("F2");

            var htmlBody = $@"
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
                        </div>";
            var textBody =
                $"Payment Not Completed\n\nHi {customerName},\n\nYour payment was not completed. Please try again to finish your purchase.\n\nPayment Details:\nPackage: {packageName}\nAmount: {currency} {formattedAmount}\nPayment ID: {paymentId}\n\nThe {_fromName} Team.";

            await SendEmailAsync(toEmail, subject, textBody, htmlBody);
        }

        public async Task SendPaymentRefundedEmailAsync(string toEmail, string customerName, string packageName, decimal amount, string currency, string paymentId, DateTime refundedAt)
        {
            var subject = "Payment Refunded";
            var formattedAmount = amount.ToString("F2");
            var formattedDate = refundedAt.ToString("MMMM dd, yyyy 'at' HH:mm UTC");

            var htmlBody = $@"
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
                        </div>";
            var textBody =
                $"Payment Refunded\n\nHi {customerName},\n\nYour payment has been refunded.\n\nPayment Details:\nPackage: {packageName}\nAmount: {currency} {formattedAmount}\nRefund Date: {formattedDate}\nPayment ID: {paymentId}\n\nThe {_fromName} Team.";

            await SendEmailAsync(toEmail, subject, textBody, htmlBody);
        }
    }
}

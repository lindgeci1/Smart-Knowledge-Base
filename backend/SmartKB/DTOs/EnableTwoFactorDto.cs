namespace SmartKB.DTOs
{
    public class EnableTwoFactorDto
    {
        public string Code { get; set; } = ""; // 6-digit TOTP code from authenticator app
    }
}

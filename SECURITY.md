# Security Policy

## Supported Versions

We release patches for security vulnerabilities. Currently supported versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take the security of Review Insights seriously. If you have discovered a security vulnerability, please follow these steps:

### 1. Do NOT Create a Public Issue

Security vulnerabilities should **never** be reported through public GitHub issues.

### 2. Email Us Directly

Please email security@reviewinsights.ai with:

- Type of vulnerability (e.g., XSS, SQL Injection, Authentication Bypass)
- Full paths of source file(s) related to the vulnerability
- Location of the affected source code (tag/branch/commit or direct URL)
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit it

### 3. Response Time

- We will acknowledge receipt of your vulnerability report within 48 hours
- We will send a more detailed response within 7 days
- We will work on a fix and coordinate the release with you

### 4. Disclosure Policy

- We request that you give us 90 days to fix the vulnerability before public disclosure
- We will credit you for the discovery (unless you prefer to remain anonymous)
- We may reach out for additional information or clarification

## Security Best Practices

When using Review Insights, please follow these security best practices:

### API Keys
- Never commit API keys to version control
- Use environment variables for all sensitive configuration
- Rotate API keys regularly
- Use separate keys for development and production

### Authentication
- Enable 2FA for all admin accounts
- Use strong, unique passwords
- Implement proper session management
- Set appropriate token expiration times

### Data Protection
- Enable SSL/TLS for all connections
- Encrypt sensitive data at rest
- Implement proper access controls
- Regular security audits

### Deployment
- Keep all dependencies up to date
- Use security headers (CSP, HSTS, etc.)
- Implement rate limiting
- Enable audit logging

## Security Features

Review Insights includes several security features:

- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: Bcrypt with appropriate salt rounds
- **Rate Limiting**: API rate limiting to prevent abuse
- **Input Validation**: Comprehensive input validation and sanitization
- **SQL Injection Protection**: Parameterized queries via Prisma ORM
- **XSS Protection**: Content Security Policy and output encoding
- **CSRF Protection**: Token-based CSRF protection
- **Audit Logging**: Comprehensive audit trail for sensitive operations

## Compliance

Review Insights is designed with compliance in mind:

- **GDPR Compliant**: User data controls and privacy features
- **SOC 2 Type II**: Security controls and processes
- **CCPA Compliant**: California privacy law compliance
- **HIPAA Ready**: Can be configured for healthcare use cases

## Security Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Security Headers](https://securityheaders.com/)
- [SSL Labs](https://www.ssllabs.com/ssltest/)
- [CVE Database](https://cve.mitre.org/)

## Contact

For security concerns, please contact:
- Email: security@reviewinsights.ai
- PGP Key: [Download](https://reviewinsights.ai/pgp-key.asc)

For general support:
- Email: support@reviewinsights.ai
- Discord: [Join our community](https://discord.gg/reviewinsights)

Thank you for helping keep Review Insights and our users safe!
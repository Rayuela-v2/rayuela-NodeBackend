import {
  buildPasswordResetEmail,
  buildVerificationEmail,
  getDefaultFromAddress,
  renderEmailLayout,
} from './mail.templates';

describe('mail.templates', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('getDefaultFromAddress', () => {
    it('should format sender with NOREPLY_EMAIL when set', () => {
      process.env.NOREPLY_EMAIL = 'support@rayuela.org';
      expect(getDefaultFromAddress()).toBe('"Rayuela" <support@rayuela.org>');
    });

    it('should fallback to default noreply address when NOREPLY_EMAIL is not set', () => {
      delete process.env.NOREPLY_EMAIL;
      expect(getDefaultFromAddress()).toBe('"Rayuela" <noreply@rayuela.com>');
    });
  });

  describe('renderEmailLayout', () => {
    it('should render HTML layout with provided props', () => {
      const html = renderEmailLayout({
        title: 'Test Title',
        heading: 'Test Heading',
        description: 'Test description text',
        buttonText: 'Click Here',
        buttonUrl: 'https://example.com/test',
        footerNote: 'Optional footer note',
      });

      expect(html).toContain('<title>Test Title</title>');
      expect(html).toContain('Test Heading');
      expect(html).toContain('Test description text');
      expect(html).toContain('Click Here');
      expect(html).toContain('https://example.com/test');
      expect(html).toContain('Optional footer note');
    });

    it('should omit footer note section when footerNote is not provided', () => {
      const html = renderEmailLayout({
        title: 'Test Title',
        heading: 'Test Heading',
        description: 'Test description text',
        buttonText: 'Click Here',
        buttonUrl: 'https://example.com/test',
      });

      expect(html).not.toContain('<hr style="border: none; border-top: 1px solid #e5e7eb;');
    });
  });

  describe('buildVerificationEmail', () => {
    it('should build email options for verification', () => {
      process.env.NOREPLY_EMAIL = 'noreply@rayuela.org';
      const email = buildVerificationEmail(
        'user@example.com',
        'Lucas',
        'https://app.rayuela.org/verify?token=123',
      );

      expect(email.from).toBe('"Rayuela" <noreply@rayuela.org>');
      expect(email.to).toBe('user@example.com');
      expect(email.subject).toBe('Verifica tu correo - Rayuela');
      expect(email.text).toContain('Lucas');
      expect(email.text).toContain('https://app.rayuela.org/verify?token=123');
      expect(email.html).toContain('https://app.rayuela.org/verify?token=123');
      expect(email.html).toContain('Verificar mi correo');
    });
  });

  describe('buildPasswordResetEmail', () => {
    it('should build email options for password reset', () => {
      process.env.NOREPLY_EMAIL = 'noreply@rayuela.org';
      const email = buildPasswordResetEmail(
        'user@example.com',
        'https://app.rayuela.org/reset?token=456',
      );

      expect(email.from).toBe('"Rayuela" <noreply@rayuela.org>');
      expect(email.to).toBe('user@example.com');
      expect(email.subject).toBe('Restablecer contraseña - Rayuela');
      expect(email.text).toContain('https://app.rayuela.org/reset?token=456');
      expect(email.html).toContain('https://app.rayuela.org/reset?token=456');
      expect(email.html).toContain('Restablecer mi contraseña');
    });
  });
});

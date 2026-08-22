export interface EmailOptions {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
}

interface EmailLayoutProps {
  title: string;
  heading: string;
  description: string;
  buttonText: string;
  buttonUrl: string;
  helperText?: string;
  footerNote?: string;
}

/**
 * Returns the configured 'From' header matching the SMTP sender address.
 */
export function getDefaultFromAddress(): string {
  return process.env.NOREPLY_EMAIL
    ? `"Rayuela" <${process.env.NOREPLY_EMAIL}>`
    : '"Rayuela" <noreply@rayuela.com>';
}

/**
 * Shared responsive HTML email layout with Rayuela branding.
 */
export function renderEmailLayout(props: EmailLayoutProps): string {
  const {
    title,
    heading,
    description,
    buttonText,
    buttonUrl,
    helperText = 'Si el botón no funciona, copia y pega el siguiente enlace en tu navegador:',
    footerNote,
  } = props;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333333; background-color: #f4f6f8; margin: 0; padding: 24px 12px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.06); border: 1px solid #e5e7eb;">
    <tr>
      <td style="background-color: #1976D2; padding: 28px 24px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 700; letter-spacing: 0.5px;">Rayuela</h1>
      </td>
    </tr>
    <tr>
      <td style="padding: 36px 32px;">
        <h2 style="margin-top: 0; color: #1f2937; font-size: 20px;">${heading}</h2>
        <p style="color: #4b5563; font-size: 15px; margin-bottom: 24px;">${description}</p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${buttonUrl}" style="background-color: #1976D2; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; display: inline-block; box-shadow: 0 2px 6px rgba(25, 118, 210, 0.3);">${buttonText}</a>
        </div>
        <p style="font-size: 13px; color: #6b7280; margin-top: 32px; line-height: 1.5;">${helperText}</p>
        <p style="font-size: 12px; word-break: break-all; color: #1976D2; background-color: #f3f4f6; padding: 10px 14px; border-radius: 6px; margin: 8px 0 24px 0;"><a href="${buttonUrl}" style="color: #1976D2; text-decoration: underline;">${buttonUrl}</a></p>
        ${
          footerNote
            ? `<hr style="border: none; border-top: 1px solid #e5e7eb; margin: 28px 0 20px 0;">
        <p style="font-size: 12px; color: #9ca3af; margin: 0;">${footerNote}</p>`
            : ''
        }
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Builds the verification email payload.
 */
export function buildVerificationEmail(
  to: string,
  name: string,
  verificationLink: string,
): EmailOptions {
  return {
    from: getDefaultFromAddress(),
    to,
    subject: 'Verifica tu correo - Rayuela',
    text: `¡Hola ${name}!\n\nGracias por unirte a Rayuela. Por favor, verifica tu correo haciendo clic en el siguiente enlace:\n${verificationLink}\n\nSi no te registraste en Rayuela, ignora este mensaje.`,
    html: renderEmailLayout({
      title: 'Verifica tu correo',
      heading: '¡Bienvenido a Rayuela!',
      description:
        'Gracias por registrarte. Para activar tu cuenta y comenzar a participar en proyectos de ciencia ciudadana, por favor verifica tu correo electrónico:',
      buttonText: 'Verificar mi correo',
      buttonUrl: verificationLink,
      footerNote:
        'Si no te registraste en Rayuela, puedes desestimar este mensaje de forma segura.',
    }),
  };
}

/**
 * Builds the password reset email payload.
 */
export function buildPasswordResetEmail(
  to: string,
  resetLink: string,
): EmailOptions {
  return {
    from: getDefaultFromAddress(),
    to,
    subject: 'Restablecer contraseña - Rayuela',
    text: `¡Hola!\n\nRecibimos una solicitud para restablecer la contraseña de tu cuenta en Rayuela. Puedes hacerlo haciendo clic en el siguiente enlace:\n${resetLink}\n\nSi no solicitaste este cambio, puedes ignorar este correo de forma segura. Tu contraseña no cambiará.`,
    html: renderEmailLayout({
      title: 'Restablecer contraseña',
      heading: 'Restablecer tu contraseña',
      description:
        'Recibimos una solicitud para restablecer la contraseña de tu cuenta en Rayuela. Haz clic en el botón siguiente para elegir una nueva:',
      buttonText: 'Restablecer mi contraseña',
      buttonUrl: resetLink,
      footerNote:
        'Si no solicitaste este cambio, puedes desestimar este mensaje de forma segura. Tu contraseña actual permanecerá sin cambios.',
    }),
  };
}

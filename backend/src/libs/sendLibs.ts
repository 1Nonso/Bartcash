const SENDLIB_URL =
   'https://sendlib.samueltuoyo.com/api/send';
const FROM = `"${process.env.MAIL_FROM_NAME || 'Bartcash'}" <${
   process.env.MAIL_FROM_ADDRESS ||
   'onboarding@resend.dev'
}>`;

async function sendMail(payload: {
   to: string;
   subject: string;
   html: string;
}) {
   const response = await fetch(
      SENDLIB_URL,
      {
         method: 'POST',
         headers: {
            Authorization: `Bearer ${process.env.SENDLIBS_API_KEY}`,
            'Content-Type':
               'application/json',
         },
         body: JSON.stringify({
            from: FROM,
            ...payload,
         }),
      },
   );

   if (!response.ok) {
      const errorBody =
         await response.text();
      console.error(
         'SendLibs error:',
         response.status,
         errorBody,
      );
      throw new Error(
         `Failed to send email: ${response.status} ${errorBody}`,
      );
   }

   return response.json();
}

function emailShell(
   bodyContent: string,
): string {
   return `
<!DOCTYPE html>
<html lang="en">
<head>
   <meta charset="utf-8" />
   <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0; padding:0; background-color:#f4f5f7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
   <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7; padding: 40px 0;">
      <tr>
         <td align="center">
            <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius: 12px; overflow:hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
               <tr>
                  <td style="background-color:#1a7f5a; padding: 28px 40px;">
                     <span style="color:#ffffff; font-size:22px; font-weight:700; letter-spacing:-0.5px;">Bartcash</span>
                  </td>
               </tr>
               <tr>
                  <td style="padding: 40px;">
                     ${bodyContent}
                  </td>
               </tr>
               <tr>
                  <td style="padding: 24px 40px; background-color:#fafafa; border-top:1px solid #eeeeee;">
                     <p style="margin:0; font-size:12px; color:#9a9a9a; line-height:1.5;">
                        You're receiving this email because an action was requested on your Bartcash account. If this wasn't you, you can safely ignore this email.
                     </p>
                  </td>
               </tr>
            </table>
            <p style="margin: 20px 0 0; font-size:12px; color:#b0b0b0;">&copy; ${new Date().getFullYear()} Bartcash. All rights reserved.</p>
         </td>
      </tr>
   </table>
</body>
</html>`;
}

export async function sendOtpEmail(
   to: string,
   otp: string,
   firstName: string,
) {
   const body = `
      <h1 style="margin:0 0 8px; font-size:20px; color:#1a1a1a;">Verify your email</h1>
      <p style="margin:0 0 28px; font-size:15px; color:#555555; line-height:1.6;">Hi ${firstName}, use the code below to verify your Bartcash account. It expires in 10 minutes.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
         <tr>
            <td align="center" style="background-color:#f0f9f4; border: 1px dashed #1a7f5a; border-radius:10px; padding: 24px;">
               <span style="font-size:36px; font-weight:700; letter-spacing:10px; color:#1a7f5a;">${otp}</span>
            </td>
         </tr>
      </table>
      <p style="margin:28px 0 0; font-size:13px; color:#999999; line-height:1.6;">Didn't request this? You can safely ignore this email — your account is still secure.</p>
   `;

   return sendMail({
      to,
      subject:
         'Your Bartcash verification code',
      html: emailShell(body),
   });
}

export async function sendPasswordResetEmail(
   to: string,
   resetLink: string,
   firstName: string,
) {
   const body = `
      <h1 style="margin:0 0 8px; font-size:20px; color:#1a1a1a;">Reset your password</h1>
      <p style="margin:0 0 28px; font-size:15px; color:#555555; line-height:1.6;">Hi ${firstName}, we received a request to reset your Bartcash password. This link expires in 1 hour.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
         <tr>
            <td align="center">
               <a href="${resetLink}" style="display:inline-block; background-color:#1a7f5a; color:#ffffff; text-decoration:none; font-size:15px; font-weight:600; padding: 14px 32px; border-radius:8px;">Reset Password</a>
            </td>
         </tr>
      </table>
      <p style="margin:28px 0 0; font-size:13px; color:#999999; line-height:1.6;">If the button doesn't work, copy and paste this link into your browser:</p>
      <p style="margin:8px 0 0; font-size:13px; color:#1a7f5a; word-break:break-all;">${resetLink}</p>
      <p style="margin:20px 0 0; font-size:13px; color:#999999; line-height:1.6;">Didn't request this? You can safely ignore this email — your password won't be changed.</p>
   `;

   return sendMail({
      to,
      subject:
         'Reset your Bartcash password',
      html: emailShell(body),
   });
}

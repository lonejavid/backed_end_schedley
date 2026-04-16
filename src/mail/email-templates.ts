const brandName = 'Schedley';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeHtmlAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

/** Shared outer shell: background, centered card, header label, footer — matches OTP emails. */
function emailShell(opts: {
  title: string;
  bodyHtml: string;
}): string {
  const safeTitle = escapeHtml(opts.title);
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f5f8fd;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f5f8fd;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:480px;background-color:#ffffff;border-radius:16px;border:1px solid rgba(0,122,255,0.12);overflow:hidden;box-shadow:0 4px 24px rgba(10,22,40,0.06);">
          <tr>
            <td style="padding:28px 28px 8px 28px;text-align:center;">
              <p style="margin:0;font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:#007aff;font-weight:600;">${brandName}</p>
              <h1 style="margin:12px 0 0 0;font-size:22px;font-weight:600;color:#0a1628;line-height:1.3;">${safeTitle}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 24px 28px;">
              ${opts.bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px 28px 28px;border-top:1px solid rgba(0,122,255,0.08);">
              <p style="margin:0;font-size:12px;color:#6b8bad;text-align:center;">© ${brandName} · <a href="mailto:notifications@schedley.com" style="color:#007aff;text-decoration:none;">notifications@schedley.com</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Confirmation sent to the person who submitted the contact form. */
export function contactConfirmationEmail(
  name: string,
  inquiryType: string,
  message: string,
): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `We received your message — ${inquiryType}`;
  const safeName = escapeHtml(name);
  const safeTopic = escapeHtml(inquiryType);
  const safeMessage = escapeHtml(message);

  const text = [
    `Hi ${name},`,
    '',
    'Thanks for contacting us. We received your message and will get back to you as soon as we can.',
    '',
    `Topic: ${inquiryType}`,
    '',
    'Your message:',
    message,
    '',
    `— ${brandName}`,
  ].join('\n');

  const bodyHtml = `
              <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#3d5a7a;">
                Hi <strong style="color:#0a1628;">${safeName}</strong>,
              </p>
              <p style="margin:0 0 20px 0;font-size:15px;line-height:1.6;color:#3d5a7a;">
                Thanks for reaching out. We’ve got your message and our team will reply as soon as we can — usually within one to two business days.
              </p>
              <p style="margin:0 0 8px 0;font-size:12px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#6b8bad;">Topic</p>
              <p style="margin:0 0 20px 0;">
                <span style="display:inline-block;padding:8px 14px;background-color:#ecfdf5;border:1px solid rgba(16,185,129,0.28);border-radius:10px;font-size:14px;font-weight:600;color:#047857;">${safeTopic}</span>
              </p>
              <p style="margin:0 0 8px 0;font-size:12px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#6b8bad;">Your message</p>
              <div style="padding:16px 18px;background-color:#e8f4fd;border-radius:12px;border:1px solid rgba(0,122,255,0.15);">
                <p style="margin:0;font-size:15px;line-height:1.65;color:#0a1628;white-space:pre-wrap;word-break:break-word;">${safeMessage}</p>
              </div>
              <p style="margin:20px 0 0 0;font-size:13px;line-height:1.5;color:#6b8bad;">
                You’re all set — no need to reply to this email unless you want to add something else.
              </p>
  `.trim();

  const html = emailShell({ title: 'Message received', bodyHtml });

  return { subject, html, text };
}

/** Sent to the applicant after they submit a careers application. */
export function jobApplicationConfirmationEmail(
  name: string,
  jobTitle: string,
): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `We received your application — ${jobTitle}`;
  const safeName = escapeHtml(name);
  const safeTitle = escapeHtml(jobTitle);
  const text = [
    `Hi ${name},`,
    '',
    `Thanks for your interest in joining ${brandName}. We received your application for:`,
    jobTitle,
    '',
    'Our team will review it and reach out if there is a strong match.',
    '',
    `— ${brandName}`,
  ].join('\n');

  const bodyHtml = `
              <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#3d5a7a;">
                Hi <strong style="color:#0a1628;">${safeName}</strong>,
              </p>
              <p style="margin:0 0 20px 0;font-size:15px;line-height:1.6;color:#3d5a7a;">
                Thank you for applying. We’ve received your application and will review it carefully.
              </p>
              <p style="margin:0 0 8px 0;font-size:12px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#6b8bad;">Role</p>
              <p style="margin:0 0 20px 0;">
                <span style="display:inline-block;padding:8px 14px;background-color:#ecfdf5;border:1px solid rgba(16,185,129,0.28);border-radius:10px;font-size:14px;font-weight:600;color:#047857;">${safeTitle}</span>
              </p>
              <p style="margin:0;font-size:14px;line-height:1.6;color:#6b8bad;">
                If your profile is a fit, someone from our team will contact you by email.
              </p>
  `.trim();

  const html = emailShell({ title: 'Application received', bodyHtml });
  return { subject, html, text };
}

/** Admin notification for a new job application (resume attached separately in SMTP). */
export function jobApplicationAdminNotificationEmail(params: {
  applicantName: string;
  applicantEmail: string;
  country: string;
  experience: string;
  jobTitle: string;
  jobDepartment?: string;
  jobId?: number;
}): {
  subject: string;
  html: string;
  text: string;
} {
  const {
    applicantName,
    applicantEmail,
    country,
    experience,
    jobTitle,
    jobDepartment,
    jobId,
  } = params;
  const subject = `[Careers] Application: ${jobTitle} — ${applicantName}`;
  const safeName = escapeHtml(applicantName);
  const safeEmail = escapeHtml(applicantEmail);
  const safeCountry = escapeHtml(country);
  const safeExp = escapeHtml(experience);
  const safeTitle = escapeHtml(jobTitle);
  const safeDept = jobDepartment ? escapeHtml(jobDepartment) : '';
  const metaLines = [
    `Name: ${applicantName}`,
    `Email: ${applicantEmail}`,
    `Country: ${country}`,
    `Experience: ${experience}`,
    `Role: ${jobTitle}`,
    jobDepartment ? `Department: ${jobDepartment}` : '',
    jobId != null ? `Job ID: ${jobId}` : '',
  ].filter(Boolean);

  const text = [
    'New job application:',
    '',
    ...metaLines,
    '',
    'The resume is attached to this email as a PDF.',
    '',
    `— ${brandName} careers form`,
  ].join('\n');

  const deptBlock = jobDepartment
    ? `<p style="margin:4px 0 0 0;font-size:14px;color:#3d5a7a;">Department: <strong>${safeDept}</strong></p>`
    : '';
  const idBlock =
    jobId != null
      ? `<p style="margin:4px 0 0 0;font-size:14px;color:#3d5a7a;">Job ID: <strong>${jobId}</strong></p>`
      : '';

  const bodyHtml = `
              <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#3d5a7a;">
                A candidate submitted an application via the careers page.
              </p>
              <div style="padding:16px 18px;background-color:#e8f4fd;border-radius:12px;border:1px solid rgba(0,122,255,0.15);">
                <p style="margin:0;font-size:14px;color:#3d5a7a;">Role: <strong style="color:#0a1628;">${safeTitle}</strong></p>
                ${deptBlock}
                ${idBlock}
                <p style="margin:12px 0 0 0;font-size:14px;color:#3d5a7a;">Name: <strong style="color:#0a1628;">${safeName}</strong></p>
                <p style="margin:4px 0 0 0;font-size:14px;color:#3d5a7a;">Email: <a href="mailto:${escapeHtmlAttr(applicantEmail)}" style="color:#007aff;text-decoration:none;">${safeEmail}</a></p>
                <p style="margin:4px 0 0 0;font-size:14px;color:#3d5a7a;">Country: <strong>${safeCountry}</strong></p>
                <p style="margin:4px 0 0 0;font-size:14px;color:#3d5a7a;">Experience: <strong>${safeExp}</strong></p>
              </div>
              <p style="margin:16px 0 0 0;font-size:13px;line-height:1.5;color:#6b8bad;">
                Resume is attached as a PDF to this message.
              </p>
  `.trim();

  const html = emailShell({ title: 'New job application', bodyHtml });
  return { subject, html, text };
}

/**
 * Fallback email when a booking cannot rely on Google Calendar invitations.
 * For **Google Meet** events: the host’s calendar creates the event with Meet + `sendUpdates=all`, so Gmail
 * sends the standard calendar invitation (Meet button, link, .ics) to the **guest** and notifies the
 * **organizer** — we intentionally do **not** send this template in that case (see `MeetingsService.createPublic`).
 * Use this for Zoom/Teams-only flows or when Calendar sync failed / is disconnected.
 */
export function publicBookingConfirmationEmail(params: {
  guestName: string;
  eventTitle: string;
  startDisplay: string;
  endDisplay: string;
  timezoneNote: string;
  /** e.g. Google Meet, Zoom, Microsoft Teams */
  platformLabel: string;
  /** Google Meet join URL when created via Calendar API */
  meetingJoinUrl?: string | null;
  /** Public booking page so guests can revisit details */
  bookingPageUrl?: string | null;
}): {
  subject: string;
  html: string;
  text: string;
} {
  const {
    guestName,
    eventTitle,
    startDisplay,
    endDisplay,
    timezoneNote,
    platformLabel,
    meetingJoinUrl,
    bookingPageUrl,
  } = params;
  const subject = `You're booked: ${eventTitle}`;
  const safeName = escapeHtml(guestName);
  const safeTitle = escapeHtml(eventTitle);
  const safeStart = escapeHtml(startDisplay);
  const safeEnd = escapeHtml(endDisplay);
  const safeTz = escapeHtml(timezoneNote);
  const safePlatform = escapeHtml(platformLabel);
  const joinUrl = meetingJoinUrl?.trim() || null;
  const bookUrl = bookingPageUrl?.trim() || null;
  const safeJoinHref = joinUrl ? escapeHtmlAttr(joinUrl) : '';
  const safeBookHref = bookUrl ? escapeHtmlAttr(bookUrl) : '';

  const textLines = [
    `Hi ${guestName},`,
    '',
    `Your meeting "${eventTitle}" is confirmed.`,
    '',
    `Video / location: ${platformLabel}`,
    joinUrl ? `Join link: ${joinUrl}` : '',
    !joinUrl && (platformLabel === 'Zoom' || platformLabel === 'Microsoft Teams')
      ? 'A direct join link was not generated automatically. Check your calendar invite from the host, or use your booking page below for updates.'
      : !joinUrl
        ? 'If you do not see a join link above, check your calendar invite or ask the host.'
        : '',
    bookUrl ? `Booking page: ${bookUrl}` : '',
    '',
    `Starts: ${startDisplay}`,
    `Ends: ${endDisplay}`,
    timezoneNote ? `Timezone: ${timezoneNote}` : '',
    '',
    `— ${brandName}`,
  ];

  const text = textLines.filter(Boolean).join('\n');

  const joinBlock = joinUrl
    ? `
              <p style="margin:20px 0 8px 0;font-size:12px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#6b8bad;">Join meeting</p>
              <p style="margin:0 0 8px 0;font-size:15px;line-height:1.6;color:#3d5a7a;">
                <a href="${safeJoinHref}" style="color:#007aff;font-weight:600;word-break:break-all;">${escapeHtml(joinUrl)}</a>
              </p>`
    : `
              <p style="margin:20px 0 8px 0;font-size:13px;line-height:1.55;color:#3d5a7a;">
                ${
                  platformLabel === 'Zoom' || platformLabel === 'Microsoft Teams'
                    ? 'This event uses <strong style="color:#0a1628;">' +
                      safePlatform +
                      '</strong>. If no join link appears here, check the calendar invite from your host or open your booking page below.'
                    : 'If you need a join link, check your calendar invite or contact the host.'
                }
              </p>`;

  const bookingBlock = bookUrl
    ? `
              <p style="margin:16px 0 8px 0;font-size:12px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#6b8bad;">Booking page</p>
              <p style="margin:0;font-size:15px;line-height:1.6;color:#3d5a7a;">
                <a href="${safeBookHref}" style="color:#007aff;font-weight:600;word-break:break-all;">${escapeHtml(bookUrl)}</a>
              </p>`
    : '';

  const bodyHtml = `
              <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#3d5a7a;">
                Hi <strong style="color:#0a1628;">${safeName}</strong>,
              </p>
              <p style="margin:0 0 20px 0;font-size:15px;line-height:1.6;color:#3d5a7a;">
                Your meeting <strong style="color:#0a1628;">${safeTitle}</strong> is confirmed.
              </p>
              <p style="margin:0 0 8px 0;font-size:12px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#6b8bad;">Video / location</p>
              <p style="margin:0 0 16px 0;font-size:16px;font-weight:600;color:#0a1628;">${safePlatform}</p>
              ${joinBlock}
              ${bookingBlock}
              <p style="margin:20px 0 8px 0;font-size:12px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#6b8bad;">Start</p>
              <p style="margin:0 0 16px 0;font-size:16px;font-weight:600;color:#0a1628;">${safeStart}</p>
              <p style="margin:0 0 8px 0;font-size:12px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#6b8bad;">End</p>
              <p style="margin:0 0 16px 0;font-size:16px;font-weight:600;color:#0a1628;">${safeEnd}</p>
              <p style="margin:0;font-size:13px;line-height:1.5;color:#6b8bad;">${safeTz}</p>
  `.trim();

  const html = emailShell({ title: 'Booking confirmed', bodyHtml });

  return { subject, html, text };
}

/** Internal alert for new contact submissions. */
export function contactAdminNotificationEmail(
  inquiryType: string,
  name: string,
  email: string,
  signedIn: boolean,
  message: string,
): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `[Contact] ${inquiryType}`;
  const safeTopic = escapeHtml(inquiryType);
  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const mailtoHref = escapeHtmlAttr(email);
  const safeMessage = escapeHtml(message);
  const signedLabel = signedIn ? 'Yes (account)' : 'No (guest)';

  const text = [
    'New contact form submission',
    `Inquiry: ${inquiryType}`,
    `From: ${name} <${email}>`,
    `Signed in: ${signedLabel}`,
    '',
    'Message:',
    message,
  ].join('\n');

  const bodyHtml = `
              <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#3d5a7a;">
                Someone submitted the contact form on your site.
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 18px 0;border-collapse:collapse;">
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid rgba(0,122,255,0.08);font-size:13px;color:#6b8bad;width:120px;vertical-align:top;">Inquiry</td>
                  <td style="padding:10px 0;border-bottom:1px solid rgba(0,122,255,0.08);font-size:14px;font-weight:600;color:#047857;">${safeTopic}</td>
                </tr>
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid rgba(0,122,255,0.08);font-size:13px;color:#6b8bad;vertical-align:top;">Name</td>
                  <td style="padding:10px 0;border-bottom:1px solid rgba(0,122,255,0.08);font-size:14px;color:#0a1628;">${safeName}</td>
                </tr>
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid rgba(0,122,255,0.08);font-size:13px;color:#6b8bad;vertical-align:top;">Email</td>
                  <td style="padding:10px 0;border-bottom:1px solid rgba(0,122,255,0.08);font-size:14px;"><a href="mailto:${mailtoHref}" style="color:#007aff;text-decoration:none;">${safeEmail}</a></td>
                </tr>
                <tr>
                  <td style="padding:10px 0;font-size:13px;color:#6b8bad;vertical-align:top;">Signed in</td>
                  <td style="padding:10px 0;font-size:14px;color:#0a1628;">${escapeHtml(signedLabel)}</td>
                </tr>
              </table>
              <p style="margin:0 0 8px 0;font-size:12px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#6b8bad;">Message</p>
              <div style="padding:16px 18px;background-color:#f8fafc;border-radius:12px;border:1px solid rgba(10,22,40,0.08);">
                <p style="margin:0;font-size:15px;line-height:1.65;color:#0a1628;white-space:pre-wrap;word-break:break-word;">${safeMessage}</p>
              </div>
  `.trim();

  const html = emailShell({ title: 'New contact request', bodyHtml });

  return { subject, html, text };
}

export function signupOtpEmail(code: string): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `Your ${brandName} verification code`;
  const text = [
    `Your verification code is: ${code}`,
    '',
    `This code expires in 10 minutes. If you didn't request this, you can ignore this email.`,
    '',
    `— ${brandName}`,
  ].join('\n');

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f5f8fd;font-family:system-ui,-apple-system,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f5f8fd;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:480px;background-color:#ffffff;border-radius:16px;border:1px solid rgba(0,122,255,0.12);overflow:hidden;">
          <tr>
            <td style="padding:28px 28px 8px 28px;text-align:center;">
              <p style="margin:0;font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:#007aff;font-weight:600;">${brandName}</p>
              <h1 style="margin:12px 0 0 0;font-size:22px;font-weight:600;color:#0a1628;">Verify your email</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 24px 28px;">
              <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#3d5a7a;">
                Use this code to finish creating your account:
              </p>
              <div style="text-align:center;padding:20px 16px;background-color:#e8f4fd;border-radius:12px;border:1px dashed rgba(0,122,255,0.25);">
                <span style="font-size:32px;font-weight:600;letter-spacing:0.35em;font-family:ui-monospace,monospace;color:#0a1628;">${code}</span>
              </div>
              <p style="margin:20px 0 0 0;font-size:13px;line-height:1.5;color:#6b8bad;">
                This code expires in <strong>10 minutes</strong>. If you didn't sign up, you can safely ignore this message.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px 28px 28px;border-top:1px solid rgba(0,122,255,0.08);">
              <p style="margin:0;font-size:12px;color:#6b8bad;text-align:center;">© ${brandName}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html, text };
}

export function loginOtpEmail(code: string): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `Your ${brandName} sign-in code`;
  const text = [
    `Your sign-in code is: ${code}`,
    '',
    `This code expires in 10 minutes. If you didn't try to sign in, ignore this email.`,
    '',
    `— ${brandName}`,
  ].join('\n');

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f5f8fd;font-family:system-ui,-apple-system,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f5f8fd;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:480px;background-color:#ffffff;border-radius:16px;border:1px solid rgba(0,122,255,0.12);overflow:hidden;">
          <tr>
            <td style="padding:28px 28px 8px 28px;text-align:center;">
              <p style="margin:0;font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:#007aff;font-weight:600;">${brandName}</p>
              <h1 style="margin:12px 0 0 0;font-size:22px;font-weight:600;color:#0a1628;">Sign in to Schedley</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 24px 28px;">
              <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#3d5a7a;">
                Enter this code where you’re signing in:
              </p>
              <div style="text-align:center;padding:20px 16px;background-color:#e8f4fd;border-radius:12px;border:1px dashed rgba(0,122,255,0.25);">
                <span style="font-size:32px;font-weight:600;letter-spacing:0.35em;font-family:ui-monospace,monospace;color:#0a1628;">${code}</span>
              </div>
              <p style="margin:20px 0 0 0;font-size:13px;line-height:1.5;color:#6b8bad;">
                Expires in <strong>10 minutes</strong>. If this wasn’t you, you can ignore this email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px 28px 28px;border-top:1px solid rgba(0,122,255,0.08);">
              <p style="margin:0;font-size:12px;color:#6b8bad;text-align:center;">© ${brandName}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html, text };
}

export function passwordResetOtpEmail(code: string): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `Your ${brandName} password reset code`;
  const text = [
    `Your password reset code is: ${code}`,
    '',
    `This code expires in 10 minutes. If you didn't request a reset, ignore this email and your password will stay the same.`,
    '',
    `— ${brandName}`,
  ].join('\n');

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f5f8fd;font-family:system-ui,-apple-system,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f5f8fd;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:480px;background-color:#ffffff;border-radius:16px;border:1px solid rgba(0,122,255,0.12);overflow:hidden;">
          <tr>
            <td style="padding:28px 28px 8px 28px;text-align:center;">
              <p style="margin:0;font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:#007aff;font-weight:600;">${brandName}</p>
              <h1 style="margin:12px 0 0 0;font-size:22px;font-weight:600;color:#0a1628;">Reset your password</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 24px 28px;">
              <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#3d5a7a;">
                Enter this code on the reset page to choose a new password:
              </p>
              <div style="text-align:center;padding:20px 16px;background-color:#e8f4fd;border-radius:12px;border:1px dashed rgba(0,122,255,0.25);">
                <span style="font-size:32px;font-weight:600;letter-spacing:0.35em;font-family:ui-monospace,monospace;color:#0a1628;">${code}</span>
              </div>
              <p style="margin:20px 0 0 0;font-size:13px;line-height:1.5;color:#6b8bad;">
                Expires in <strong>10 minutes</strong>. If you didn’t request this, ignore this message.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px 28px 28px;border-top:1px solid rgba(0,122,255,0.08);">
              <p style="margin:0;font-size:12px;color:#6b8bad;text-align:center;">© ${brandName}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html, text };
}

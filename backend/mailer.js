const nodemailer = require('nodemailer');

function isConfigured() {
    return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransport() {
    const port = parseInt(process.env.SMTP_PORT, 10) || 587;
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port,
        secure: process.env.SMTP_SECURE === 'true' || port === 465,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });
}

async function sendResetEmail(to, resetLink) {
    if (!isConfigured()) {
        console.log('[mailer] SMTP not configured. Reset link:', resetLink);
        return { skipped: true, link: resetLink };
    }

    const from = process.env.MAIL_FROM || 'Koladaisi University Health Records <no-reply@koladaisi.edu.ng>';
    const transporter = getTransport();

    await transporter.sendMail({
        from,
        to,
        subject: 'Reset your password — Koladaisi University Health Records',
        html: `
            <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px">
                <div style="text-align:center;margin-bottom:20px">
                    <div style="width:48px;height:48px;border-radius:50%;background:#0056b3;color:#fff;font-size:20px;font-weight:bold;display:inline-flex;align-items:center;justify-content:center">KU</div>
                    <h2 style="margin:12px 0 4px;color:#111827">Reset your password</h2>
                    <p style="margin:0;color:#6b7280;font-size:14px">Koladaisi University Health Records</p>
                </div>
                <p style="color:#374151;font-size:15px;line-height:1.6">Hello,</p>
                <p style="color:#374151;font-size:15px;line-height:1.6">We received a request to reset the password for your account. Click the button below to set a new password. This link expires in <strong>1 hour</strong>.</p>
                <div style="text-align:center;margin:28px 0">
                    <a href="${resetLink}" style="background:#0056b3;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;display:inline-block">Reset Password</a>
                </div>
                <p style="color:#6b7280;font-size:13px;line-height:1.6">If the button does not work, copy and paste this link into your browser:<br><a href="${resetLink}" style="color:#0056b3;word-break:break-all">${resetLink}</a></p>
                <p style="color:#6b7280;font-size:13px;line-height:1.6">If you did not request this, you can safely ignore this email — your password will not change.</p>
                <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
                <p style="color:#9ca3af;font-size:12px;text-align:center;margin:0">Koladaisi University Ibadan • Digital Health Records Management System</p>
            </div>
        `
    });

    return { sent: true };
}

module.exports = { sendResetEmail, isConfigured };

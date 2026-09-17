"""
Email Service — HireRank (Resend API)
======================================
Sends invitation emails via Resend (https://resend.com).

Configuration (backend/.env):
  RESEND_API_KEY = re_xxxxxxxxxxxxxxxxxxxx
  EMAIL_FROM     = onboarding@resend.dev          ← Resend sandbox (works immediately)
                   OR noreply@yourdomain.com       ← after verifying domain at resend.com/domains
  APP_BASE_URL   = http://localhost:5173

If RESEND_API_KEY is blank, the function logs the invite link to the
uvicorn console so development still works without an API key.
"""

import os
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)


def _cfg(key: str, default: str = "") -> str:
    # 1. Read latest value directly from .env so modifications apply immediately without server restart
    try:
        from pathlib import Path
        from dotenv import dotenv_values
        env_path = Path(__file__).resolve().parents[2] / ".env"
        if env_path.exists():
            vals = dotenv_values(env_path)
            if key in vals and vals[key] is not None and str(vals[key]).strip():
                return str(vals[key]).strip()
    except Exception:
        pass

    # 2. Fall back to settings or os.getenv
    val = getattr(settings, key, None)
    if val is not None and str(val).strip():
        return str(val).strip()
    return os.getenv(key, default).strip()


def _send_smtp(
    *,
    to_email: str,
    subject: str,
    html: str,
    plain: str,
    from_name: str,
) -> tuple[bool, str | None]:
    """
    Sends an email using standard SMTP (e.g. Gmail with App Password).
    Works with ANY recipient email address without domain verification.
    """
    smtp_user = _cfg("SMTP_USER")
    smtp_password = _cfg("SMTP_PASSWORD")
    smtp_host = _cfg("SMTP_HOST", "smtp.gmail.com")
    smtp_port_val = _cfg("SMTP_PORT", "465")

    if not smtp_user or not smtp_password:
        return False, "SMTP_USER or SMTP_PASSWORD is not configured in backend/.env"

    try:
        import smtplib
        import ssl
        from email.mime.multipart import MIMEMultipart
        from email.mime.text import MIMEText

        port = int(smtp_port_val)
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{from_name} <{smtp_user}>"
        msg["To"] = to_email

        msg.attach(MIMEText(plain, "plain", "utf-8"))
        msg.attach(MIMEText(html, "html", "utf-8"))

        ctx = ssl.create_default_context()
        if port == 465:
            with smtplib.SMTP_SSL(smtp_host, port, context=ctx) as server:
                server.login(smtp_user, smtp_password)
                server.sendmail(smtp_user, [to_email], msg.as_string())
        else:
            with smtplib.SMTP(smtp_host, port) as server:
                server.starttls(context=ctx)
                server.login(smtp_user, smtp_password)
                server.sendmail(smtp_user, [to_email], msg.as_string())

        logger.info("[EMAIL] Sent via SMTP (%s) to %s", smtp_host, to_email)
        return True, None
    except Exception as exc:
        err = str(exc)
        logger.error("[EMAIL] SMTP failed for %s: %s", to_email, err)
        return False, f"SMTP Error: {err}"


def send_team_invite_email(
    *,
    to_email: str,
    to_name: str | None,
    invite_url: str,
    workspace_name: str,
    inviter_email: str,
    role: str,
) -> tuple[bool, str | None]:
    """
    Sends a workspace invitation email via SMTP or Resend.
    Returns (True, None) on success, (False, error_message) on failure.
    """
    api_key   = _cfg("RESEND_API_KEY")
    from_addr = _cfg("EMAIL_FROM", "onboarding@resend.dev")
    from_name = _cfg("EMAIL_FROM_NAME", "HireRank")
    smtp_user = _cfg("SMTP_USER")
    smtp_pass = _cfg("SMTP_PASSWORD")

    display_name = to_name or to_email.split("@")[0].title()
    subject = f"You've been invited to join {workspace_name} on HireRank"

    # ── HTML body ──────────────────────────────────────────────────────────
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>{subject}</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:'Segoe UI',Arial,sans-serif;color:#fff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0"
             style="background:#0d0d14;border-radius:20px;border:1px solid rgba(255,255,255,0.08);overflow:hidden;">

        <!-- Header gradient -->
        <tr>
          <td style="background:linear-gradient(135deg,#06b6d4,#3b82f6);padding:32px 40px;text-align:center;">
            <span style="font-size:22px;font-weight:900;color:#fff;letter-spacing:-0.5px;">
              <span style="display:inline-block;width:36px;height:36px;background:rgba(255,255,255,0.2);
                           border-radius:9px;line-height:36px;text-align:center;margin-right:8px;font-size:18px;">H</span>
              HireRank
            </span>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px 40px 32px;">
            <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#06b6d4;
                       text-transform:uppercase;letter-spacing:2px;">Workspace Invitation</p>
            <h1 style="margin:0 0 20px;font-size:26px;font-weight:900;color:#fff;line-height:1.2;">
              You're invited to join<br/>
              <span style="color:#06b6d4;">{workspace_name}</span>
            </h1>

            <p style="margin:0 0 28px;font-size:15px;color:rgba(255,255,255,0.6);line-height:1.65;">
              Hi <strong style="color:#fff;">{display_name}</strong>,<br/><br/>
              <strong style="color:#fff;">{inviter_email}</strong> has invited you to collaborate
              on <strong style="color:#fff;">{workspace_name}</strong> as a
              <span style="color:#06b6d4;font-weight:700;">{role}</span>.
            </p>

            <!-- CTA Button -->
            <div style="text-align:center;margin:32px 0;">
              <a href="{invite_url}"
                 style="display:inline-block;padding:16px 40px;
                        background:linear-gradient(135deg,#06b6d4,#3b82f6);
                        color:#fff;font-size:15px;font-weight:800;text-decoration:none;
                        border-radius:14px;letter-spacing:0.2px;
                        box-shadow:0 8px 32px rgba(6,182,212,0.35);">
                Accept Invitation &amp; Join Workspace →
              </a>
            </div>

            <!-- Fallback link -->
            <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);
                        border-radius:12px;padding:16px 20px;margin-bottom:24px;">
              <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:rgba(255,255,255,0.4);
                         text-transform:uppercase;letter-spacing:1.5px;">Or copy this link</p>
              <p style="margin:0;font-size:12px;color:#06b6d4;word-break:break-all;font-family:monospace;">
                {invite_url}
              </p>
            </div>

            <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.3);line-height:1.5;">
              This invitation link is valid for <strong style="color:rgba(255,255,255,0.55);">7 days</strong>.
              If you didn't expect this email, you can safely ignore it.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:18px 40px 26px;border-top:1px solid rgba(255,255,255,0.05);text-align:center;">
            <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.2);">
              Sent by HireRank &bull; AI-powered Recruiting Platform
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>"""

    plain = (
        f"Hi {display_name},\n\n"
        f"{inviter_email} has invited you to join {workspace_name} on HireRank as a {role}.\n\n"
        f"Accept your invitation (valid 7 days):\n{invite_url}\n\n"
        f"If you didn't expect this email, please ignore it.\n\n— The HireRank Team"
    )

    # 1. Prefer SMTP if configured (can send to ANY recipient without domain verification)
    if smtp_user and smtp_pass:
        return _send_smtp(
            to_email=to_email,
            subject=subject,
            html=html,
            plain=plain,
            from_name=from_name,
        )

    # 2. Try Resend if configured
    if api_key:
        try:
            import resend
            resend.api_key = api_key

            params: resend.Emails.SendParams = {
                "from": f"{from_name} <{from_addr}>",
                "to": [to_email],
                "subject": subject,
                "html": html,
                "text": plain,
            }
            resp = resend.Emails.send(params)
            logger.info("[EMAIL] Resend invite sent to %s — id=%s", to_email, resp.get("id"))
            return True, None
        except Exception as exc:
            err_str = str(exc)
            if "only send testing emails to your own email address" in err_str.lower():
                err_str = (
                    "Resend sandbox only allows sending to your own Resend account email. "
                    "To send to any Gmail address, add your Gmail App Password to backend/.env or verify a domain."
                )
            logger.error("[EMAIL] Resend failed for %s: %s", to_email, err_str)
            return False, err_str

    # 3. Dev fallback: neither is configured
    logger.warning("[EMAIL] Neither SMTP nor RESEND_API_KEY set. Invite link for %s:\n  %s", to_email, invite_url)
    return False, "Email sending is not configured (neither SMTP nor RESEND_API_KEY)"


def send_candidate_invite_email(
    *,
    to_email: str,
    candidate_name: str | None,
    job_title: str,
    company_name: str,
    recruiter_email: str,
    message: str | None = None,
    stage: str = "assessment",
) -> tuple[bool, str | None]:
    """
    Sends an interview / assessment invitation email to a candidate via Resend.
    Returns (True, None) on success, (False, error_message) on failure.
    """
    api_key   = _cfg("RESEND_API_KEY")
    from_addr = _cfg("EMAIL_FROM", "onboarding@resend.dev")
    from_name = _cfg("EMAIL_FROM_NAME", "HireRank")

    display_name = candidate_name or to_email.split("@")[0].title()
    stage_display = stage.replace("_", " ").capitalize()
    subject = f"Invitation: {stage_display} for {job_title} at {company_name}"

    message_block = ""
    if message and message.strip():
        message_block = f"""
            <div style="background:rgba(255,255,255,0.04);border-left:3px solid #06b6d4;border-radius:0 12px 12px 0;padding:16px 20px;margin-bottom:24px;">
              <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.85);line-height:1.5;">{message}</p>
            </div>
        """

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>{subject}</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:'Segoe UI',Arial,sans-serif;color:#fff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0"
             style="background:#0d0d14;border-radius:20px;border:1px solid rgba(255,255,255,0.08);overflow:hidden;">

        <!-- Header gradient -->
        <tr>
          <td style="background:linear-gradient(135deg,#06b6d4,#3b82f6);padding:32px 40px;text-align:center;">
            <span style="font-size:22px;font-weight:900;color:#fff;letter-spacing:-0.5px;">
              <span style="display:inline-block;width:36px;height:36px;background:rgba(255,255,255,0.2);border-radius:9px;line-height:36px;text-align:center;margin-right:8px;font-size:18px;">H</span>
              {company_name}
            </span>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px 40px 32px;">
            <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#06b6d4;text-transform:uppercase;letter-spacing:2px;">Application Update</p>
            <h1 style="margin:0 0 20px;font-size:24px;font-weight:900;color:#fff;line-height:1.2;">
              You're invited to the next stage for<br/>
              <span style="color:#06b6d4;">{job_title}</span>
            </h1>

            <p style="margin:0 0 20px;font-size:15px;color:rgba(255,255,255,0.7);line-height:1.65;">
              Hi <strong style="color:#fff;">{display_name}</strong>,<br/><br/>
              Thank you for your interest in joining <strong style="color:#fff;">{company_name}</strong>.
              We reviewed your profile and would like to invite you forward to the
              <strong style="color:#06b6d4;">{stage_display}</strong> stage.
            </p>

            {message_block}

            <p style="margin:0 0 24px;font-size:14px;color:rgba(255,255,255,0.6);line-height:1.6;">
              Please reply directly to this email or reach out to <strong style="color:#fff;">{recruiter_email}</strong> to coordinate interview scheduling.
            </p>

            <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.3);line-height:1.5;">
              Best regards,<br/>
              <strong style="color:rgba(255,255,255,0.7);">{company_name} Recruiting Team</strong>
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:18px 40px 26px;border-top:1px solid rgba(255,255,255,0.05);text-align:center;">
            <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.2);">
              Powered by HireRank &bull; AI-driven Recruitment Platform
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>"""

    plain = (
        f"Hi {display_name},\n\n"
        f"You have been invited to the {stage_display} stage for {job_title} at {company_name}.\n\n"
        f"{message + chr(10) + chr(10) if message else ''}"
        f"Please reply to this email or reach out to {recruiter_email} for next steps.\n\n"
        f"Best regards,\n{company_name} Recruiting Team"
    )

    smtp_user = _cfg("SMTP_USER")
    smtp_pass = _cfg("SMTP_PASSWORD")

    # 1. Prefer SMTP if configured (can send to ANY recipient without domain verification)
    if smtp_user and smtp_pass:
        return _send_smtp(
            to_email=to_email,
            subject=subject,
            html=html,
            plain=plain,
            from_name=from_name,
        )

    # 2. Try Resend if configured
    if api_key:
        try:
            import resend
            resend.api_key = api_key

            params: resend.Emails.SendParams = {
                "from": f"{from_name} <{from_addr}>",
                "to": [to_email],
                "subject": subject,
                "html": html,
                "text": plain,
            }
            resp = resend.Emails.send(params)
            logger.info("[EMAIL] Resend candidate invite sent to %s — id=%s", to_email, resp.get("id"))
            return True, None
        except Exception as exc:
            err_str = str(exc)
            if "only send testing emails to your own email address" in err_str.lower():
                err_str = (
                    "Resend sandbox only allows sending to your own Resend account email. "
                    "To send to any candidate email, add your Gmail App Password to backend/.env or verify a domain."
                )
            logger.error("[EMAIL] Resend candidate invite failed for %s: %s", to_email, err_str)
            return False, err_str

    # 3. Fallback: neither configured
    logger.warning("[EMAIL] Neither SMTP nor RESEND_API_KEY set. Candidate invite for %s", to_email)
    return False, "Email sending is not configured (neither SMTP nor RESEND_API_KEY)"


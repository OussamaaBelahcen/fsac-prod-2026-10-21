import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from config import Config
from services.logger_service import LoggerService


def send_email(to_email, subject, body_html):
    if not Config.MAIL_USERNAME or not Config.MAIL_PASSWORD:
        LoggerService.log_action('system', 'SYSTEM', 'EMAIL_SKIPPED',
                                 f'SMTP non configuré, email non envoyé à {to_email}', 'WARNING')
        return False
    try:
        msg = MIMEMultipart('alternative')
        msg['From'] = Config.MAIL_FROM
        msg['To'] = to_email
        msg['Subject'] = subject
        msg.attach(MIMEText(body_html, 'html', 'utf-8'))

        server = smtplib.SMTP(Config.MAIL_SERVER, Config.MAIL_PORT)
        if Config.MAIL_USE_TLS:
            server.starttls()
        server.login(Config.MAIL_USERNAME, Config.MAIL_PASSWORD)
        server.sendmail(Config.MAIL_FROM, to_email, msg.as_string())
        server.quit()

        LoggerService.log_action('system', 'SYSTEM', 'EMAIL_SENT',
                                 f'Email envoyé à {to_email} - Sujet: {subject}', 'SUCCESS')
        return True
    except Exception as e:
        LoggerService.log_error('EmailService', f'Erreur envoi email à {to_email}: {str(e)}')
        return False


def build_welcome_email(nom, prenom, email, password_temp):
    subject = 'Vos identifiants de connexion — FSAC'
    body_html = f"""
    <html><body style="font-family: 'Segoe UI', Arial, sans-serif; background: #f5f7fc; padding: 30px;">
    <div style="max-width: 560px; margin: auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 30px rgba(0,0,0,0.08);">
        <div style="background: linear-gradient(135deg, #0B162C 0%, #043775 50%, #0258b3 100%); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 22px; font-weight: 700;">FSAC</h1>
            <p style="color: rgba(255,255,255,0.8); margin: 6px 0 0; font-size: 13px;">Plateforme d'évaluation des dossiers scientifiques</p>
        </div>
        <div style="padding: 32px 30px;">
            <p style="font-size: 15px; color: #333;">Bonjour <strong>{prenom} {nom}</strong>,</p>
            <p style="font-size: 14px; color: #555; line-height: 1.6;">Votre compte a été créé sur la plateforme FSAC.</p>
            <div style="background: #f0f5ff; border-radius: 12px; padding: 20px; margin: 20px 0;">
                <p style="margin: 0 0 8px; font-size: 13px; color: #555;"><strong>Email :</strong> {email}</p>
                <p style="margin: 0; font-size: 13px; color: #555;"><strong>Mot de passe temporaire :</strong> <code style="background: #e2e8f0; padding: 3px 10px; border-radius: 4px; font-size: 13px;">{password_temp}</code></p>
            </div>
            <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 14px 16px; border-radius: 8px; margin: 16px 0;">
                <p style="margin: 0; font-size: 13px; color: #856404;"><strong>⚠ Important :</strong> Vous devez changer ce mot de passe lors de votre première connexion.</p>
            </div>
            <p style="font-size: 14px; color: #555; line-height: 1.6;">Lien d'accès : <a href="{Config.SECRET_KEY and 'http://127.0.0.1:5001/login' or 'http://127.0.0.1:5001/login'}" style="color: #1a56db;">http://127.0.0.1:5001/login</a></p>
        </div>
        <div style="background: #f8f9fa; padding: 16px 30px; text-align: center; border-top: 1px solid #eef1f5;">
            <p style="margin: 0; font-size: 12px; color: #999;">Université Hassan II de Casablanca — FSAC</p>
        </div>
    </div>
    </body></html>
    """
    return subject, body_html

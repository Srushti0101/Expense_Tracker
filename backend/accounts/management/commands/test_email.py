from smtplib import SMTPAuthenticationError, SMTPException, SMTPServerDisconnected

from django.conf import settings
from django.core.mail import get_connection, send_mail
from django.core.mail.backends.console import EmailBackend as ConsoleEmailBackend
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = 'Send a test message using the configured email backend.'

    def add_arguments(self, parser):
        parser.add_argument('recipient', help='Email address to receive the test message.')

    def handle(self, *args, **options):
        connection = get_connection()
        if isinstance(connection, ConsoleEmailBackend):
            raise CommandError(
                'The console email backend does not send email. Configure Gmail SMTP '
                'in the backend server environment and restart the backend before '
                'running this command.'
            )

        if not settings.EMAIL_HOST or not settings.EMAIL_HOST_USER or not settings.EMAIL_HOST_PASSWORD:
            raise CommandError(
                'SMTP is missing its host, username, or password. Check the email settings '
                'in the backend server environment.'
            )

        try:
            sent = send_mail(
                'ExpenseFlow email delivery test',
                'Email delivery is configured correctly.',
                settings.DEFAULT_FROM_EMAIL,
                [options['recipient']],
                connection=connection,
                fail_silently=False,
            )
        except SMTPAuthenticationError as exc:
            raise CommandError(
                'Gmail rejected the SMTP login. Check EMAIL_HOST_USER and use a Google '
                'App Password created for that same account for EMAIL_HOST_PASSWORD, '
                'not your regular Gmail password.'
            ) from exc
        except SMTPServerDisconnected as exc:
            raise CommandError(
                'Gmail closed the SMTP connection during login or delivery. Verify that '
                'EMAIL_HOST_USER is the account that created EMAIL_HOST_PASSWORD, check '
                'for Windows or IIS environment variables overriding .env, then restart '
                'the backend.'
            ) from exc
        except (OSError, SMTPException) as exc:
            raise CommandError(
                f'Email delivery failed ({type(exc).__name__}). Check the SMTP host, '
                'port, TLS setting, network access, and Gmail App Password.'
            ) from exc

        if sent != 1:
            raise CommandError('The email backend did not confirm sending the test message.')

        self.stdout.write(self.style.SUCCESS('Test email sent. Check the recipient inbox and spam folder.'))

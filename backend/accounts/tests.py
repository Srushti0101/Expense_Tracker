from urllib.parse import parse_qs, urlparse
from smtplib import SMTPAuthenticationError, SMTPException, SMTPServerDisconnected
from unittest.mock import patch

from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.core.cache import cache
from django.core import mail
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import SimpleTestCase, override_settings
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework.test import APITestCase


class TestEmailCommandTests(SimpleTestCase):
    @override_settings(EMAIL_BACKEND='django.core.mail.backends.console.EmailBackend')
    def test_command_refuses_console_backend(self):
        with self.assertRaisesMessage(CommandError, 'console email backend does not send email'):
            call_command('test_email', 'user@example.com')

    @override_settings(
        EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
        EMAIL_HOST='smtp.gmail.com',
        EMAIL_HOST_USER='sender@example.com',
        EMAIL_HOST_PASSWORD='test-password',
        DEFAULT_FROM_EMAIL='sender@example.com',
    )
    def test_command_sends_test_message_with_configured_backend(self):
        call_command('test_email', 'user@example.com', verbosity=0)

        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ['user@example.com'])


@override_settings(
    EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
    EMAIL_HOST='smtp.gmail.com',
    EMAIL_HOST_USER='sender@example.com',
    EMAIL_HOST_PASSWORD='test-password',
    CORS_ALLOWED_ORIGINS=['http://localhost:8080', 'http://localhost:5173'],
    FRONTEND_URL='http://localhost:5173',
)
class PasswordResetAPITests(APITestCase):
    def setUp(self):
        cache.clear()
        self.user = get_user_model().objects.create_user(
            username='alice',
            email='alice@example.com',
            password='Original-safe-pass-92',
        )

    def test_otp_request_emails_code_to_registered_address(self):
        response = self.client.post(
            '/api/auth/password-reset/otp/',
            {'email': 'alice@example.com'},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['detail'], 'If that email is registered, an OTP has been sent.')
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ['alice@example.com'])
        self.assertRegex(mail.outbox[0].body, r'Your OTP is \d{6}\.')

    def test_otp_request_does_not_reveal_unknown_email(self):
        response = self.client.post(
            '/api/auth/password-reset/otp/',
            {'email': 'unknown@example.com'},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, {'detail': 'If that email is registered, an OTP has been sent.'})
        self.assertEqual(len(mail.outbox), 0)

    @override_settings(EMAIL_BACKEND='django.core.mail.backends.console.EmailBackend')
    def test_otp_request_rejects_console_email_backend(self):
        response = self.client.post(
            '/api/auth/password-reset/otp/',
            {'email': 'alice@example.com'},
        )

        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.data['code'], 'email_delivery_not_configured')
        self.assertEqual(len(mail.outbox), 0)

    @patch('accounts.views.send_mail', side_effect=SMTPException('mail server unavailable'))
    def test_otp_request_reports_email_delivery_failure(self, send_mail_mock):
        response = self.client.post(
            '/api/auth/password-reset/otp/',
            {'email': 'alice@example.com'},
        )

        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.data['code'], 'email_delivery_failed')
        send_mail_mock.assert_called_once()

    @patch(
        'accounts.views.send_mail',
        side_effect=SMTPAuthenticationError(535, b'Authentication failed'),
    )
    def test_otp_request_reports_gmail_authentication_failure(self, send_mail_mock):
        response = self.client.post(
            '/api/auth/password-reset/otp/',
            {'email': 'alice@example.com'},
        )

        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.data['code'], 'email_smtp_authentication_failed')
        send_mail_mock.assert_called_once()

    @patch(
        'accounts.views.send_mail',
        side_effect=SMTPServerDisconnected('Connection unexpectedly closed'),
    )
    def test_otp_request_reports_gmail_smtp_disconnect(self, send_mail_mock):
        response = self.client.post(
            '/api/auth/password-reset/otp/',
            {'email': 'alice@example.com'},
        )

        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.data['code'], 'email_smtp_disconnected')
        send_mail_mock.assert_called_once()

    def test_otp_confirm_changes_password(self):
        self.client.post(
            '/api/auth/password-reset/otp/',
            {'email': 'alice@example.com'},
        )
        otp = mail.outbox[0].body.split('Your OTP is ')[1].split('.')[0]
        response = self.client.post(
            '/api/auth/password-reset/otp/confirm/',
            {
                'email': 'alice@example.com',
                'otp': otp,
                'new_password': 'A-new-and-secure-password-483!',
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(authenticate(username='alice', password='A-new-and-secure-password-483!'))
        self.assertEqual(
            self.client.post(
                '/api/auth/password-reset/otp/confirm/',
                {
                    'email': 'alice@example.com',
                    'otp': otp,
                    'new_password': 'Another-new-and-secure-password-483!',
                },
            ).status_code,
            400,
        )

    def test_otp_confirm_rejects_invalid_password_reset_otp_input(self):
        response = self.client.post(
            '/api/auth/password-reset/otp/confirm/',
            {
                'email': 'alice@example.com',
                'otp': 'not-an-otp',
                'new_password': 'A-new-and-secure-password-483!',
            },
        )

        self.assertEqual(response.status_code, 400)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('Original-safe-pass-92'))

    def test_request_sends_a_reset_link_without_revealing_unknown_emails(self):
        existing_response = self.client.post(
            '/api/auth/password-reset/',
            {'identifier': 'alice@example.com'},
            HTTP_ORIGIN='http://localhost:8080',
        )
        unknown_response = self.client.post(
            '/api/auth/password-reset/',
            {'identifier': 'unknown@example.com'},
        )

        self.assertEqual(existing_response.status_code, 200)
        self.assertEqual(existing_response.data['delivery'], 'accepted')
        self.assertEqual(existing_response.data, unknown_response.data)
        self.assertEqual(len(mail.outbox), 1)
        reset_url = mail.outbox[0].body.splitlines()[3]
        query = parse_qs(urlparse(reset_url).query)
        self.assertEqual(urlparse(reset_url).netloc, 'localhost:8080')
        self.assertIn('uid', query)
        self.assertIn('token', query)

    def test_username_requests_reset_link_to_the_users_registered_email(self):
        response = self.client.post(
            '/api/auth/password-reset/',
            {'identifier': 'alice'},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ['alice@example.com'])

    def test_untrusted_origin_is_not_used_for_reset_link(self):
        self.client.post(
            '/api/auth/password-reset/',
            {'identifier': 'alice@example.com'},
            HTTP_ORIGIN='https://untrusted.example',
        )

        reset_url = mail.outbox[0].body.splitlines()[3]
        self.assertEqual(urlparse(reset_url).netloc, 'localhost:5173')

    @override_settings(EMAIL_BACKEND='django.core.mail.backends.console.EmailBackend')
    def test_request_reports_when_email_delivery_is_not_configured(self):
        response = self.client.post(
            '/api/auth/password-reset/',
            {'identifier': 'alice@example.com'},
        )

        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.data['code'], 'email_delivery_not_configured')

    @patch('accounts.views.send_mail', side_effect=SMTPException('mail server unavailable'))
    def test_request_reports_email_delivery_failure(self, send_mail_mock):
        response = self.client.post(
            '/api/auth/password-reset/',
            {'identifier': 'alice@example.com'},
        )

        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.data['code'], 'email_delivery_failed')
        send_mail_mock.assert_called_once()

    @patch(
        'accounts.views.send_mail',
        side_effect=SMTPServerDisconnected('Connection unexpectedly closed'),
    )
    def test_request_reports_gmail_smtp_disconnect(self, send_mail_mock):
        response = self.client.post(
            '/api/auth/password-reset/',
            {'identifier': 'alice@example.com'},
        )

        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.data['code'], 'email_smtp_disconnected')
        send_mail_mock.assert_called_once()

    def test_confirm_changes_password_and_invalidates_reset_token(self):
        uid = urlsafe_base64_encode(force_bytes(self.user.pk))
        token = default_token_generator.make_token(self.user)
        payload = {
            'uid': uid,
            'token': token,
            'new_password': 'A-new-and-secure-password-483!',
        }

        response = self.client.post('/api/auth/password-reset/confirm/', payload)

        self.assertEqual(response.status_code, 200)
        self.assertIsNotNone(authenticate(username='alice', password=payload['new_password']))
        self.assertEqual(
            self.client.post('/api/auth/password-reset/confirm/', payload).status_code,
            400,
        )

    def test_invalid_reset_token_does_not_change_password(self):
        uid = urlsafe_base64_encode(force_bytes(self.user.pk))
        response = self.client.post('/api/auth/password-reset/confirm/', {
            'uid': uid,
            'token': 'invalid-token',
            'new_password': 'A-new-and-secure-password-483!',
        })

        self.assertEqual(response.status_code, 400)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('Original-safe-pass-92'))

    def test_weak_new_password_is_rejected(self):
        uid = urlsafe_base64_encode(force_bytes(self.user.pk))
        token = default_token_generator.make_token(self.user)
        response = self.client.post('/api/auth/password-reset/confirm/', {
            'uid': uid,
            'token': token,
            'new_password': 'password',
        })

        self.assertEqual(response.status_code, 400)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('Original-safe-pass-92'))


class AuthenticationAPITests(APITestCase):
    def test_registration_requires_an_email_address(self):
        response = self.client.post('/api/auth/register/', {
            'username': 'alice',
            'password': 'pass1234',
        })
        self.assertEqual(response.status_code, 400)
        self.assertIn('email', response.data)

    def test_register_login_me_and_refresh(self):
        registration = self.client.post('/api/auth/register/', {
            'username': 'alice',
            'email': 'alice@example.com',
            'password': 'pass1234',
        })
        self.assertEqual(registration.status_code, 201)

        login = self.client.post('/api/auth/login/', {
            'username': 'alice',
            'password': 'pass1234',
        })
        self.assertEqual(login.status_code, 200)
        self.assertIn('access', login.data)
        self.assertIn('refresh', login.data)

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {login.data["access"]}')
        profile = self.client.get('/api/auth/me/')
        self.assertEqual(profile.status_code, 200)
        self.assertEqual(profile.data['username'], 'alice')

        refresh = self.client.post('/api/auth/refresh/', {'refresh': login.data['refresh']})
        self.assertEqual(refresh.status_code, 200)
        self.assertIn('access', refresh.data)

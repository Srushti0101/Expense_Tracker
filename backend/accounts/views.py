import logging
import secrets
from smtplib import SMTPAuthenticationError, SMTPException, SMTPServerDisconnected
from urllib.parse import urlencode

from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.mail import get_connection, send_mail
from django.core.mail.backends.console import EmailBackend as ConsoleEmailBackend
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework import generics, permissions, serializers, status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from .models import PasswordResetOTP
from .serializers import RegisterSerializer


logger = logging.getLogger(__name__)


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]


class PasswordResetRequestSerializer(serializers.Serializer):
    identifier = serializers.CharField(max_length=254, trim_whitespace=True)


class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField(write_only=True, trim_whitespace=False)


class PasswordResetOTPRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetOTPConfirmSerializer(serializers.Serializer):
    email = serializers.EmailField()
    otp = serializers.RegexField(r'^\d{6}$')
    new_password = serializers.CharField(write_only=True, trim_whitespace=False)


class PasswordResetRequestView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'password_reset'

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        identifier = serializer.validated_data['identifier']
        origin = request.headers.get('Origin')
        frontend_url = (
            origin
            if origin in settings.CORS_ALLOWED_ORIGINS
            else settings.FRONTEND_URL
        )
        if (
            not settings.EMAIL_HOST
            or not settings.EMAIL_HOST_USER
            or not settings.EMAIL_HOST_PASSWORD
        ):
            return Response(
                {
                    'code': 'email_delivery_not_configured',
                    'detail': (
                        'Gmail delivery is not configured. Set EMAIL_HOST_USER and '
                        'EMAIL_HOST_PASSWORD in the backend server environment, then '
                        'restart the backend process.'
                    ),
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        email_connection = get_connection()
        if isinstance(email_connection, ConsoleEmailBackend):
            return Response(
                {
                    'code': 'email_delivery_not_configured',
                    'detail': (
                        'Gmail delivery is disabled. Set EMAIL_BACKEND to '
                        'django.core.mail.backends.smtp.EmailBackend in the backend server '
                        'environment, then restart the backend process.'
                    ),
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        matching_users = User.objects.filter(is_active=True)
        if '@' in identifier:
            matching_users = matching_users.filter(email__iexact=identifier)
        else:
            matching_users = matching_users.filter(username__iexact=identifier)

        for user in matching_users:
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            reset_url = (
                f"{frontend_url.rstrip('/')}/reset-password/"
                f"?{urlencode({'uid': uid, 'token': token})}"
            )
            message = (
                f"Hello {user.username},\n\n"
                f"Use this link to reset your ExpenseFlow password:\n{reset_url}\n\n"
                "If you did not request a password reset, you can ignore this email."
            )
            try:
                send_mail(
                    'Reset your ExpenseFlow password',
                    message,
                    settings.DEFAULT_FROM_EMAIL,
                    [user.email],
                    connection=email_connection,
                    fail_silently=False,
                )
            except SMTPServerDisconnected:
                logger.exception('Gmail disconnected during password reset email delivery.')
                return Response(
                    {
                        'code': 'email_smtp_disconnected',
                        'detail': (
                            'Gmail closed the SMTP connection. Verify the sending Gmail '
                            'address and current Google App Password, then restart the '
                            'backend and try again.'
                        ),
                    },
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )
            except (OSError, SMTPException):
                logger.exception('Password reset email delivery failed.')
                return Response(
                    {
                        'code': 'email_delivery_failed',
                        'detail': (
                            'We could not deliver the password reset email. '
                            'Please verify Gmail SMTP settings and try again.'
                        ),
                    },
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )

        return Response(
            {
                'delivery': 'accepted',
                'detail': (
                    'If an account matches that username or email, a password reset link '
                    'has been sent to the email address registered to the account.'
                ),
            },
            status=status.HTTP_200_OK,
        )


class PasswordResetConfirmView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        uid = serializer.validated_data['uid']
        token = serializer.validated_data['token']

        try:
            user_id = urlsafe_base64_decode(uid).decode()
            user = User.objects.get(pk=user_id, is_active=True)
        except (TypeError, ValueError, OverflowError, UnicodeDecodeError, User.DoesNotExist):
            user = None

        if user is None or not default_token_generator.check_token(user, token):
            return Response(
                {'detail': 'This password reset link is invalid or has expired. Request a new link.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        password = serializer.validated_data['new_password']
        try:
            validate_password(password, user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({'new_password': exc.messages}) from exc

        user.set_password(password)
        user.save(update_fields=['password'])
        return Response(
            {'detail': 'Your password has been reset. You can now sign in.'},
            status=status.HTTP_200_OK,
        )


@api_view(['GET'])
def me(request):
    u = request.user
    return Response({'id': u.id, 'username': u.username, 'email': u.email})


# ---------------------------------------------------------------------------
# OTP-based password reset
# ---------------------------------------------------------------------------

OTP_GENERIC_RESPONSE = {'detail': 'If that email is registered, an OTP has been sent.'}


class SendOTPView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'password_reset'

    def post(self, request):
        input_serializer = PasswordResetOTPRequestSerializer(data=request.data)
        input_serializer.is_valid(raise_exception=True)
        email = input_serializer.validated_data['email']
        if (
            not settings.EMAIL_HOST
            or not settings.EMAIL_HOST_USER
            or not settings.EMAIL_HOST_PASSWORD
        ):
            return Response(
                {
                    'code': 'email_delivery_not_configured',
                    'detail': (
                        'Email delivery is not configured. Set EMAIL_HOST_USER and '
                        'EMAIL_HOST_PASSWORD in the backend server environment, then '
                        'restart the backend process.'
                    ),
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        email_connection = get_connection()
        if isinstance(email_connection, ConsoleEmailBackend):
            return Response(
                {
                    'code': 'email_delivery_not_configured',
                    'detail': (
                        'Email delivery is disabled. Configure an SMTP email backend '
                        'in the backend server environment, then restart the backend.'
                    ),
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        user = User.objects.filter(email__iexact=email, is_active=True).first()
        if user:
            PasswordResetOTP.objects.filter(user=user, used=False).update(used=True)
            otp = f'{secrets.randbelow(1_000_000):06d}'
            reset_otp = PasswordResetOTP.objects.create(
                user=user,
                code_hash=make_password(otp),
            )
            try:
                sent_count = send_mail(
                    'Your ExpenseFlow password reset code',
                    f'Your OTP is {otp}. It expires in 10 minutes.\n'
                    "If you didn't request this, ignore this email.",
                    settings.DEFAULT_FROM_EMAIL,
                    [user.email],
                    connection=email_connection,
                    fail_silently=False,
                )
            except SMTPAuthenticationError:
                reset_otp.used = True
                reset_otp.save(update_fields=['used'])
                logger.exception('Gmail rejected SMTP authentication for OTP delivery.')
                return Response(
                    {
                        'code': 'email_smtp_authentication_failed',
                        'detail': (
                            'Gmail rejected the SMTP login. Verify that EMAIL_HOST_USER '
                            'is the Gmail account that created EMAIL_HOST_PASSWORD, and '
                            'that EMAIL_HOST_PASSWORD is a current Google App Password.'
                        ),
                    },
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )
            except SMTPServerDisconnected:
                reset_otp.used = True
                reset_otp.save(update_fields=['used'])
                logger.exception('Gmail disconnected during OTP SMTP authentication or delivery.')
                return Response(
                    {
                        'code': 'email_smtp_disconnected',
                        'detail': (
                            'Gmail closed the SMTP connection. Verify the sending Gmail '
                            'account and its current Google App Password. Check for '
                            'Windows or IIS environment variables overriding the backend '
                            '.env file, then restart the backend.'
                        ),
                    },
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )
            except (OSError, SMTPException):
                reset_otp.used = True
                reset_otp.save(update_fields=['used'])
                logger.exception('OTP email delivery failed.')
                return Response(
                    {
                        'code': 'email_delivery_failed',
                        'detail': (
                            'We could not deliver the OTP email. Verify the email '
                            'server settings and try again.'
                        ),
                    },
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )
            if sent_count != 1:
                reset_otp.used = True
                reset_otp.save(update_fields=['used'])
                logger.error('OTP email backend did not accept the message for delivery.')
                return Response(
                    {
                        'code': 'email_delivery_failed',
                        'detail': (
                            'We could not deliver the OTP email. Verify the email '
                            'server settings and try again.'
                        ),
                    },
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )
        # Same reply whether or not the user exists.
        return Response(OTP_GENERIC_RESPONSE)


class ResetWithOTPView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        input_serializer = PasswordResetOTPConfirmSerializer(data=request.data)
        input_serializer.is_valid(raise_exception=True)
        email = input_serializer.validated_data['email']
        otp = input_serializer.validated_data['otp']
        new_password = input_serializer.validated_data['new_password']
        bad = Response(
            {'detail': 'Invalid or expired OTP.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

        user = User.objects.filter(email__iexact=email, is_active=True).first()
        if not user:
            return bad
        rec = (
            PasswordResetOTP.objects.filter(user=user, used=False)
            .order_by('-created_at')
            .first()
        )
        if not rec or rec.is_expired() or rec.attempts >= 5:
            return bad
        if not check_password(otp, rec.code_hash):
            rec.attempts += 1
            rec.save(update_fields=['attempts'])
            return bad
        try:
            validate_password(new_password, user)
        except DjangoValidationError as e:
            return Response(
                {'detail': ' '.join(e.messages)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(new_password)
        user.save(update_fields=['password'])
        rec.used = True
        rec.save(update_fields=['used'])
        return Response({'detail': 'Password updated. You can sign in now.'})
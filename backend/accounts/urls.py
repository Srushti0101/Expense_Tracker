from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .views import (
    PasswordResetConfirmView,
    PasswordResetRequestView,
    RegisterView,
    ResetWithOTPView,
    SendOTPView,
    me,
)

urlpatterns = [
    path('register/', RegisterView.as_view()),
    path('password-reset/', PasswordResetRequestView.as_view()),
    path('password-reset/confirm/', PasswordResetConfirmView.as_view()),
    path('login/', TokenObtainPairView.as_view()),
    path('refresh/', TokenRefreshView.as_view()),
    path('password-reset/otp/', SendOTPView.as_view()),
    path('password-reset/otp/confirm/', ResetWithOTPView.as_view()),
    path('me/', me),
]
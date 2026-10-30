from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import BudgetViewSet, CategoryViewSet, ExpenseViewSet, DashboardSummaryView

router = DefaultRouter()
router.register('budgets', BudgetViewSet, basename='budget')
router.register('categories', CategoryViewSet, basename='category')
router.register('expenses', ExpenseViewSet, basename='expense')

urlpatterns = [path('dashboard/summary/', DashboardSummaryView.as_view())] + router.urls
from datetime import datetime
import django_filters
from rest_framework.exceptions import ValidationError
from .models import Expense


class ExpenseFilter(django_filters.FilterSet):
    month = django_filters.CharFilter(method='filter_month')   # YYYY-MM
    date_from = django_filters.DateFilter(field_name='date', lookup_expr='gte')
    date_to = django_filters.DateFilter(field_name='date', lookup_expr='lte')

    class Meta:
        model = Expense
        fields = ['category']

    def filter_month(self, queryset, name, value):
        try:
            month = datetime.strptime(value, '%Y-%m').date()
        except ValueError:
            raise ValidationError('Use YYYY-MM format.')
        if month.strftime('%Y-%m') != value:
            raise ValidationError('Use YYYY-MM format.')
        return queryset.filter(date__year=month.year, date__month=month.month)
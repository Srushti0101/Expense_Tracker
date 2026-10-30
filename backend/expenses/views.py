from datetime import date, datetime
from django.db.models import Sum, ProtectedError
from rest_framework import viewsets, status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView
from .filters import ExpenseFilter
from .models import Budget, Category, Expense
from .serializers import BudgetSerializer, CategorySerializer, ExpenseSerializer


class BudgetViewSet(viewsets.ModelViewSet):
    serializer_class = BudgetSerializer
    pagination_class = None
    http_method_names = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options']

    def get_queryset(self):
        queryset = Budget.objects.filter(user=self.request.user)
        month = self.request.query_params.get('month')
        if month:
            try:
                parsed_month = datetime.strptime(month, '%Y-%m').date()
            except ValueError:
                raise ValidationError({'month': 'Use YYYY-MM format.'})
            if parsed_month.strftime('%Y-%m') != month:
                raise ValidationError({'month': 'Use YYYY-MM format.'})
            queryset = queryset.filter(month=parsed_month.replace(day=1))
        return queryset

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class CategoryViewSet(viewsets.ModelViewSet):
    serializer_class = CategorySerializer
    pagination_class = None   # categories are small; return a plain list

    def get_queryset(self):
        return Category.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def destroy(self, request, *args, **kwargs):
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response({'detail': 'This category has expenses and cannot be deleted.'},
                            status=status.HTTP_400_BAD_REQUEST)


class ExpenseViewSet(viewsets.ModelViewSet):
    serializer_class = ExpenseSerializer
    filterset_class = ExpenseFilter
    search_fields = ['title']
    ordering_fields = ['date', 'amount']

    def get_queryset(self):
        return Expense.objects.filter(user=self.request.user).select_related('category')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class DashboardSummaryView(APIView):
    def get(self, request):
        month = request.query_params.get('month') or date.today().strftime('%Y-%m')
        try:
            parsed_month = datetime.strptime(month, '%Y-%m').date()
        except ValueError:
            return Response({'month': 'Use YYYY-MM format.'}, status=status.HTTP_400_BAD_REQUEST)
        year, mon = parsed_month.year, parsed_month.month
        qs = Expense.objects.filter(user=request.user, date__year=year, date__month=mon)

        total = qs.aggregate(t=Sum('amount'))['t'] or 0
        by_category = qs.values('category__name').annotate(total=Sum('amount')).order_by('-total')
        recent = Expense.objects.filter(user=request.user).select_related('category')[:5]
        budget = Budget.objects.filter(user=request.user, month=parsed_month.replace(day=1)).first()

        return Response({
            'month': month,
            'total': total,
            'by_category': [{'category': c['category__name'], 'total': c['total']} for c in by_category],
            'recent': ExpenseSerializer(recent, many=True, context={'request': request}).data,
            'budget': BudgetSerializer(budget).data if budget else None,
        })
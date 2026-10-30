from datetime import date
from rest_framework import serializers
from .models import Budget, Category, Expense


class BudgetSerializer(serializers.ModelSerializer):
    class Meta:
        model = Budget
        fields = ['id', 'month', 'limit_amount']
        validators = []

    def validate_month(self, value):
        if value.day != 1:
            raise serializers.ValidationError('Budget month must be the first day of the month.')
        user = self.context['request'].user
        budgets = Budget.objects.filter(user=user, month=value)
        if self.instance:
            budgets = budgets.exclude(pk=self.instance.pk)
        if budgets.exists():
            raise serializers.ValidationError('A budget already exists for this month.')
        return value

    def validate_limit_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError('Budget must be greater than zero.')
        return value


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name', 'created_at']
        read_only_fields = ['created_at']

    def validate_name(self, value):
        qs = Category.objects.filter(user=self.context['request'].user, name__iexact=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError('You already have a category with this name.')
        return value


class ExpenseSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)

    class Meta:
        model = Expense
        fields = ['id', 'title', 'amount', 'date', 'category', 'category_name', 'notes', 'created_at']
        read_only_fields = ['created_at']

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError('Amount must be greater than zero.')
        return value

    def validate_date(self, value):
        if value > date.today():
            raise serializers.ValidationError('Date cannot be in the future.')
        return value

    def validate_category(self, value):
        if value.user != self.context['request'].user:
            raise serializers.ValidationError('Invalid category.')
        return value
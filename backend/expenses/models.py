from django.conf import settings
from django.db import models
from django.db.models import Q


class Category(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='categories')
    name = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']
        verbose_name_plural = 'categories'
        constraints = [models.UniqueConstraint(fields=['user', 'name'], name='unique_category_per_user')]

    def __str__(self):
        return self.name


class Expense(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='expenses')
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name='expenses')
    title = models.CharField(max_length=200)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    date = models.DateField()
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-date', '-id']
        indexes = [
            models.Index(fields=['user', '-date']),
            models.Index(fields=['user', 'category']),
        ]
        constraints = [models.CheckConstraint(condition=Q(amount__gt=0), name='amount_positive')]

    def __str__(self):
        return f'{self.title} - {self.amount}'


class Budget(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='budgets')
    month = models.DateField()
    limit_amount = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        ordering = ['-month']
        constraints = [
            models.UniqueConstraint(fields=['user', 'month'], name='unique_budget_per_user_month'),
            models.CheckConstraint(condition=Q(limit_amount__gt=0), name='budget_limit_positive'),
        ]

    def __str__(self):
        return f'{self.user} - {self.month:%Y-%m}'
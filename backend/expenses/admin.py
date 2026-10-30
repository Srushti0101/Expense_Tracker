from django.contrib import admin
from .models import Budget, Category, Expense

admin.site.register(Category)
admin.site.register(Expense)
admin.site.register(Budget)
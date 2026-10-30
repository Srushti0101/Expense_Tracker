from datetime import date, timedelta
from django.contrib.auth.models import User
from rest_framework.test import APITestCase
from .models import Budget, Category, Expense


class ExpenseAPITests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user('alice', password='pass1234')
        self.other = User.objects.create_user('bob', password='pass1234')
        self.cat = Category.objects.create(user=self.user, name='Food')
        self.client.force_authenticate(self.user)

    def payload(self, **kw):
        return {'title': 'Lunch', 'amount': '250.00', 'date': str(date.today()), 'category': self.cat.id, **kw}

    def test_create_expense(self):
        self.assertEqual(self.client.post('/api/expenses/', self.payload()).status_code, 201)

    def test_invalid_amount(self):
        self.assertEqual(self.client.post('/api/expenses/', self.payload(amount='0')).status_code, 400)

    def test_future_date(self):
        future = str(date.today() + timedelta(days=2))
        self.assertEqual(self.client.post('/api/expenses/', self.payload(date=future)).status_code, 400)

    def test_other_user_gets_404(self):
        e = Expense.objects.create(user=self.other, category=Category.objects.create(user=self.other, name='X'),
                                   title='Secret', amount=10, date=date.today())
        self.assertEqual(self.client.get(f'/api/expenses/{e.id}/').status_code, 404)

    def test_other_users_category_and_expense_are_hidden(self):
        other_category = Category.objects.create(user=self.other, name='Other food')
        other_expense = Expense.objects.create(
            user=self.other,
            category=other_category,
            title='Other lunch',
            amount=10,
            date=date.today(),
        )
        self.assertEqual(self.client.get(f'/api/categories/{other_category.id}/').status_code, 404)
        self.assertEqual(self.client.patch(
            f'/api/categories/{other_category.id}/',
            {'name': 'Changed'},
        ).status_code, 404)
        self.assertEqual(self.client.delete(f'/api/categories/{other_category.id}/').status_code, 404)
        self.assertEqual(self.client.patch(
            f'/api/expenses/{other_expense.id}/',
            {'title': 'Changed'},
        ).status_code, 404)
        self.assertEqual(self.client.delete(f'/api/expenses/{other_expense.id}/').status_code, 404)

    def test_category_with_expenses_cannot_be_deleted(self):
        Expense.objects.create(user=self.user, category=self.cat, title='A', amount=5, date=date.today())
        self.assertEqual(self.client.delete(f'/api/categories/{self.cat.id}/').status_code, 400)

    def test_category_crud(self):
        listing = self.client.get('/api/categories/')
        self.assertEqual(listing.status_code, 200)
        self.assertEqual([category['id'] for category in listing.data], [self.cat.id])

        created = self.client.post('/api/categories/', {'name': 'Travel'})
        self.assertEqual(created.status_code, 201)
        category_id = created.data['id']

        renamed = self.client.patch(f'/api/categories/{category_id}/', {'name': 'Trips'})
        self.assertEqual(renamed.status_code, 200)
        self.assertEqual(renamed.data['name'], 'Trips')

        deleted = self.client.delete(f'/api/categories/{category_id}/')
        self.assertEqual(deleted.status_code, 204)

    def test_expense_list_update_delete_and_dashboard(self):
        created = self.client.post('/api/expenses/', self.payload())
        self.assertEqual(created.status_code, 201)
        expense_id = created.data['id']

        listing = self.client.get('/api/expenses/', {'search': 'Lunch', 'month': date.today().strftime('%Y-%m')})
        self.assertEqual(listing.status_code, 200)
        self.assertEqual(listing.data['count'], 1)
        self.assertEqual(listing.data['results'][0]['id'], expense_id)
        date_range = self.client.get('/api/expenses/', {
            'date_from': str(date.today()),
            'date_to': str(date.today()),
        })
        self.assertEqual(date_range.data['count'], 1)

        updated = self.client.patch(f'/api/expenses/{expense_id}/', {'title': 'Dinner'})
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.data['title'], 'Dinner')

        summary = self.client.get('/api/dashboard/summary/', {'month': date.today().strftime('%Y-%m')})
        self.assertEqual(summary.status_code, 200)
        self.assertEqual(len(summary.data['by_category']), 1)
        self.assertEqual(summary.data['recent'][0]['id'], expense_id)
        self.assertIsNone(summary.data['budget'])

        deleted = self.client.delete(f'/api/expenses/{expense_id}/')
        self.assertEqual(deleted.status_code, 204)

    def test_expense_filters_sorting_and_ten_item_pagination(self):
        month_start = date.today().replace(day=1)
        for amount in range(1, 12):
            Expense.objects.create(
                user=self.user,
                category=self.cat,
                title=f'Purchase {amount}',
                amount=amount,
                date=month_start + timedelta(days=amount - 1),
            )

        response = self.client.get('/api/expenses/', {
            'category': self.cat.id,
            'month': date.today().strftime('%Y-%m'),
            'date_from': str(month_start),
            'date_to': str(month_start + timedelta(days=10)),
            'search': 'Purchase',
            'ordering': '-amount',
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 11)
        self.assertEqual(len(response.data['results']), 10)
        self.assertEqual(response.data['results'][0]['amount'], '11.00')
        self.assertIsNotNone(response.data['next'])

        second_page = self.client.get('/api/expenses/', {
            'category': self.cat.id,
            'search': 'Purchase',
            'ordering': '-amount',
            'page': 2,
        })
        self.assertEqual(second_page.data['count'], 11)
        self.assertEqual(len(second_page.data['results']), 1)
        self.assertEqual(second_page.data['results'][0]['amount'], '1.00')

    def test_monthly_budget_crud_and_dashboard_warning_data(self):
        month = date.today().replace(day=1)
        created = self.client.post('/api/budgets/', {
            'month': str(month),
            'limit_amount': '1000.00',
        })
        self.assertEqual(created.status_code, 201)
        budget_id = created.data['id']
        self.assertEqual(Budget.objects.get(pk=budget_id).user, self.user)
        other_budget = Budget.objects.create(user=self.other, month=month, limit_amount='500.00')
        self.assertEqual(self.client.get(f'/api/budgets/{other_budget.id}/').status_code, 404)

        duplicate = self.client.post('/api/budgets/', {
            'month': str(month),
            'limit_amount': '2000.00',
        })
        self.assertEqual(duplicate.status_code, 400)

        invalid = self.client.post('/api/budgets/', {
            'month': str(month.replace(day=2)),
            'limit_amount': '0',
        })
        self.assertEqual(invalid.status_code, 400)

        dashboard = self.client.get('/api/dashboard/summary/', {'month': month.strftime('%Y-%m')})
        self.assertEqual(dashboard.status_code, 200)
        self.assertEqual(dashboard.data['budget']['id'], budget_id)

        listing = self.client.get('/api/budgets/', {'month': month.strftime('%Y-%m')})
        self.assertEqual(len(listing.data), 1)
        self.assertEqual(self.client.patch(
            f'/api/budgets/{budget_id}/',
            {'limit_amount': '1500.00'},
        ).status_code, 200)
        self.assertEqual(self.client.delete(f'/api/budgets/{budget_id}/').status_code, 204)

    def test_invalid_dashboard_month_returns_validation_error(self):
        response = self.client.get('/api/dashboard/summary/', {'month': 'not-a-month'})
        self.assertEqual(response.status_code, 400)

    def test_invalid_expense_month_filter_returns_validation_error(self):
        response = self.client.get('/api/expenses/', {'month': '2026-13'})
        self.assertEqual(response.status_code, 400)
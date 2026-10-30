function firstMessage(value) {
  if (Array.isArray(value)) return value.map(firstMessage).filter(Boolean).join(' ');
  if (typeof value === 'string') return value;
  return '';
}

export function getApiErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
  if (!error.response) {
    return error.message === 'Network Error'
      ? 'Could not reach the server. Check that the backend is running and try again.'
      : fallback;
  }

  const data = error.response.data;
  if (typeof data === 'string') return data;
  if (data?.detail) return firstMessage(data.detail);
  if (data?.non_field_errors) return firstMessage(data.non_field_errors);

  const fieldMessage = data && Object.values(data).map(firstMessage).find(Boolean);
  return fieldMessage || fallback;
}

export function getFieldError(errors, field) {
  return errors?.[field] ? firstMessage(errors[field]) : '';
}

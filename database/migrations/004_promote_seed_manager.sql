UPDATE users
SET role = 'MANAGER', updated_at = NOW()
WHERE email = 'bob.manager@accessflow.dev';


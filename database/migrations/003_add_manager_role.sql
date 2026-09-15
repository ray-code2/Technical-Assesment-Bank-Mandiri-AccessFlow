-- Existing installations applied 001 before MANAGER became an explicit role.
-- PostgreSQL requires a newly-added enum value to be committed before it is used.
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'MANAGER' AFTER 'USER';


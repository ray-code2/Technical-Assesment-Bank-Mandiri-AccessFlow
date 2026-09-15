-- All demo users use the password Password123! (bcrypt cost 12).
INSERT INTO users (id, email, full_name, password_hash, role) VALUES
  ('00000000-0000-4000-8000-000000000002', 'bob.manager@accessflow.dev', 'Bob Manager', '$2b$12$vd7noZa5adlt9y/SRNrFjOXo/J90OGan1TRchJKx/cgcMuclLB826', 'MANAGER'),
  ('00000000-0000-4000-8000-000000000003', 'carol.admin@accessflow.dev', 'Carol Admin', '$2b$12$vd7noZa5adlt9y/SRNrFjOXo/J90OGan1TRchJKx/cgcMuclLB826', 'ADMIN');

INSERT INTO users (id, email, full_name, password_hash, role, manager_id) VALUES
  ('00000000-0000-4000-8000-000000000001', 'alice.user@accessflow.dev', 'Alice Employee', '$2b$12$vd7noZa5adlt9y/SRNrFjOXo/J90OGan1TRchJKx/cgcMuclLB826', 'USER', '00000000-0000-4000-8000-000000000002'),
  ('00000000-0000-4000-8000-000000000004', 'diego.user@accessflow.dev', 'Diego Employee', '$2b$12$vd7noZa5adlt9y/SRNrFjOXo/J90OGan1TRchJKx/cgcMuclLB826', 'USER', '00000000-0000-4000-8000-000000000002');

INSERT INTO access_types (id, name, description, icon) VALUES
  ('10000000-0000-4000-8000-000000000001', 'VPN Access', 'Secure remote access to the company network.', 'shield'),
  ('10000000-0000-4000-8000-000000000002', 'GitHub / GitLab Access', 'Source repositories and engineering collaboration tools.', 'code'),
  ('10000000-0000-4000-8000-000000000003', 'Figma Access', 'Design files, prototypes, and shared component libraries.', 'palette'),
  ('10000000-0000-4000-8000-000000000004', 'Jira Access', 'Project boards, issue tracking, and sprint planning.', 'ticket');

-- Request and approval tables intentionally start empty.
-- Data is created only through the application's request and decision flows.

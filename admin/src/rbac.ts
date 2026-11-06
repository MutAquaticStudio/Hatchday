/** Ma trận quyền của trang quản trị. PHẢI khớp private.admin_can trong supabase/migrations/20261206000000_admin.sql (test: supabase/tests/admin.test.ts). */
export type Role = 'owner' | 'ops' | 'support' | 'moderator' | 'analyst';
export type Action = 'dashboard' | 'search' | 'get_user' | 'grant' | 'campaign' | 'announce' | 'event' | 'flag' | 'audit' | 'report' | 'sanction' | 'word' | 'role';
export const ROLES: Role[] = ['owner', 'ops', 'support', 'moderator', 'analyst'];
export const ACTIONS: Action[] = ['dashboard', 'search', 'get_user', 'grant', 'campaign', 'announce', 'event', 'flag', 'audit', 'report', 'sanction', 'word', 'role'];
const ALLOW: Record<Exclude<Role, 'owner'>, Action[]> = {
  ops: ['dashboard', 'search', 'get_user', 'campaign', 'announce', 'event', 'flag', 'audit'],
  support: ['dashboard', 'search', 'get_user', 'grant'],
  moderator: ['search', 'report', 'sanction', 'word'],
  analyst: ['dashboard'],
};
export const can = (role: Role | null | undefined, action: Action): boolean => (role === 'owner' ? true : role ? ALLOW[role].includes(action) : false);
/** Email chỉ hiện cho các vai trò này. */
export const seesEmail = (role: Role | null | undefined): boolean => role === 'owner' || role === 'ops' || role === 'support';

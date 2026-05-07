export type UserRole = 'doctor' | 'patient';

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
}

export type AppVariables = {
  userId: string;
  userRole: UserRole;
};

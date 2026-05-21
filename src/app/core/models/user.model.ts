export type UserRole   = 'admin' | 'viewer';
export type UserStatus = 'active' | 'inactive';

export interface User {
  id:     number;
  name:   string;
  email:  string;
  role:   UserRole;
  status: UserStatus;
}

export interface CreateUserDto {
  name:  string;
  email: string;
  role:  UserRole;
}

export interface UpdateUserDto extends Partial<CreateUserDto> {}

export interface ApiError {
  message: string;
  code?:   string;
}

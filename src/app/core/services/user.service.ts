import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import type { User, CreateUserDto, UpdateUserDto } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http    = inject(HttpClient);
  private readonly baseUrl = '/api/users';

  getUsers(): Observable<User[]> {
    return this.http.get<User[]>(this.baseUrl).pipe(
      catchError(err => throwError(() => err))
    );
  }

  getUserById(id: number): Observable<User> {
    return this.http.get<User>(`${this.baseUrl}/${id}`).pipe(
      catchError(err => throwError(() => err))
    );
  }

  createUser(dto: CreateUserDto): Observable<User> {
    return this.http.post<User>(this.baseUrl, dto).pipe(
      catchError(err => throwError(() => err))
    );
  }

  updateUser(id: number, dto: UpdateUserDto): Observable<User> {
    return this.http.put<User>(`${this.baseUrl}/${id}`, dto).pipe(
      catchError(err => throwError(() => err))
    );
  }

  deleteUser(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`).pipe(
      catchError(err => throwError(() => err))
    );
  }
}

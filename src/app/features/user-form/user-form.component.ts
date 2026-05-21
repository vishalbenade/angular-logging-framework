import { Component, EventEmitter, OnInit, Output, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl } from '@angular/forms';
import { UserService } from '../../core/services/user.service';
import type { User, CreateUserDto } from '../../core/models/user.model';

@Component({
  selector: 'app-user-form',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './user-form.component.html',
})
export class UserFormComponent implements OnInit {
  @Output() userCreated = new EventEmitter<User>();
  @Output() cancelled   = new EventEmitter<void>();

  private readonly fb          = inject(FormBuilder);
  private readonly userService = inject(UserService);

  form!:        FormGroup;
  isSubmitting  = false;
  errorMessage  = '';

  ngOnInit(): void {
    this.form = this.fb.group({
      name:  ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      email: ['', [Validators.required, Validators.email]],
      role:  ['viewer', Validators.required],
    });
  }

  get nameControl():  AbstractControl { return this.form.get('name')!;  }
  get emailControl(): AbstractControl { return this.form.get('email')!; }
  get roleControl():  AbstractControl { return this.form.get('role')!;  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';

    const dto = this.form.value as CreateUserDto;

    this.userService.createUser(dto).subscribe({
      next: (user) => {
        this.isSubmitting = false;
        this.userCreated.emit(user);
        this.form.reset({ role: 'viewer' });
      },
      error: (err) => {
        this.isSubmitting = false;
        this.errorMessage = err.error?.message ?? 'Failed to create user. Please try again.';
      },
    });
  }

  onCancel(): void {
    this.form.reset({ role: 'viewer' });
    this.errorMessage = '';
    this.cancelled.emit();
  }
}

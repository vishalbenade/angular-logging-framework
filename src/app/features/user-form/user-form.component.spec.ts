import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of, throwError } from 'rxjs';
import { UserFormComponent } from './user-form.component';
import { UserService } from '../../core/services/user.service';
import type { User } from '../../core/models/user.model';

const CREATED_USER: User = {
  id: 99, name: 'New User', email: 'new@example.com', role: 'viewer', status: 'active',
};

function buildMockUserService(overrides: Partial<typeof UserService.prototype> = {}) {
  return {
    createUser: vi.fn().mockReturnValue(of(CREATED_USER)),
    ...overrides,
  };
}

describe('UserFormComponent', () => {

  // ── Initial state ───────────────────────────────────────────────────────────

  it('renders all form fields', async () => {
    await render(UserFormComponent, {
      providers: [{ provide: UserService, useValue: buildMockUserService() }],
    });
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/role/i)).toBeInTheDocument();
  });

  it('disables submit button when form is pristine and invalid', async () => {
    await render(UserFormComponent, {
      providers: [{ provide: UserService, useValue: buildMockUserService() }],
    });
    expect(screen.getByRole('button', { name: /submit/i })).toBeDisabled();
  });

  it('role defaults to "viewer"', async () => {
    await render(UserFormComponent, {
      providers: [{ provide: UserService, useValue: buildMockUserService() }],
    });
    expect(screen.getByRole('option', { name: /viewer/i })).toBeInTheDocument();
  });

  // ── Validation — Name ───────────────────────────────────────────────────────

  it('shows "Name is required" after touching empty name field', async () => {
    const user = userEvent.setup();
    await render(UserFormComponent, {
      providers: [{ provide: UserService, useValue: buildMockUserService() }],
    });
    await user.click(screen.getByLabelText(/name/i));
    await user.tab();
    await waitFor(() =>
      expect(screen.getByText(/name is required/i)).toBeInTheDocument()
    );
  });

  it('shows minlength error when name is 1 character', async () => {
    const user = userEvent.setup();
    await render(UserFormComponent, {
      providers: [{ provide: UserService, useValue: buildMockUserService() }],
    });
    await user.type(screen.getByLabelText(/name/i), 'A');
    await user.tab();
    await waitFor(() =>
      expect(screen.getByText(/at least 2 characters/i)).toBeInTheDocument()
    );
  });

  it('does not show name error when name is valid', async () => {
    const user = userEvent.setup();
    await render(UserFormComponent, {
      providers: [{ provide: UserService, useValue: buildMockUserService() }],
    });
    await user.type(screen.getByLabelText(/name/i), 'Alice');
    await user.tab();
    expect(screen.queryByText(/name is required/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/at least 2 characters/i)).not.toBeInTheDocument();
  });

  // ── Validation — Email ──────────────────────────────────────────────────────

  it('shows "Email is required" after touching empty email', async () => {
    const user = userEvent.setup();
    await render(UserFormComponent, {
      providers: [{ provide: UserService, useValue: buildMockUserService() }],
    });
    await user.click(screen.getByLabelText(/email/i));
    await user.tab();
    await waitFor(() =>
      expect(screen.getByText(/email is required/i)).toBeInTheDocument()
    );
  });

  it('shows "Invalid email format" for malformed email', async () => {
    const user = userEvent.setup();
    await render(UserFormComponent, {
      providers: [{ provide: UserService, useValue: buildMockUserService() }],
    });
    await user.type(screen.getByLabelText(/email/i), 'not-an-email');
    await user.tab();
    await waitFor(() =>
      expect(screen.getByText(/invalid email format/i)).toBeInTheDocument()
    );
  });

  it('clears email error when a valid email is entered', async () => {
    const user = userEvent.setup();
    await render(UserFormComponent, {
      providers: [{ provide: UserService, useValue: buildMockUserService() }],
    });
    await user.type(screen.getByLabelText(/email/i), 'bad');
    await user.tab();
    await waitFor(() => screen.getByText(/invalid email format/i));

    await user.clear(screen.getByLabelText(/email/i));
    await user.type(screen.getByLabelText(/email/i), 'good@example.com');
    await user.tab();
    expect(screen.queryByText(/invalid email format/i)).not.toBeInTheDocument();
  });

  // ── Submit — happy path ─────────────────────────────────────────────────────

  it('enables submit when all fields are valid', async () => {
    const user = userEvent.setup();
    await render(UserFormComponent, {
      providers: [{ provide: UserService, useValue: buildMockUserService() }],
    });
    await user.type(screen.getByLabelText(/name/i),  'Alice');
    await user.type(screen.getByLabelText(/email/i), 'alice@example.com');
    expect(screen.getByRole('button', { name: /submit/i })).toBeEnabled();
  });

  it('calls UserService.createUser with form values on submit', async () => {
    const mockService = buildMockUserService();
    const user        = userEvent.setup();
    await render(UserFormComponent, {
      providers: [{ provide: UserService, useValue: mockService }],
    });

    await user.type(screen.getByLabelText(/name/i),  'New User');
    await user.type(screen.getByLabelText(/email/i), 'new@example.com');
    await user.selectOptions(screen.getByLabelText(/role/i), 'admin');
    await user.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() =>
      expect(mockService.createUser).toHaveBeenCalledWith({
        name:  'New User',
        email: 'new@example.com',
        role:  'admin',
      })
    );
  });

  it('emits userCreated event with created user on success', async () => {
    const mockService = buildMockUserService();
    const user        = userEvent.setup();
    const emitSpy     = vi.fn();

    const { fixture } = await render(UserFormComponent, {
      providers: [{ provide: UserService, useValue: mockService }],
    });
    fixture.componentInstance.userCreated.subscribe(emitSpy);

    await user.type(screen.getByLabelText(/name/i),  'New User');
    await user.type(screen.getByLabelText(/email/i), 'new@example.com');
    await user.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() => expect(emitSpy).toHaveBeenCalledWith(CREATED_USER));
  });

  it('resets form after successful submission', async () => {
    const user = userEvent.setup();
    await render(UserFormComponent, {
      providers: [{ provide: UserService, useValue: buildMockUserService() }],
    });

    await user.type(screen.getByLabelText(/name/i),  'Alice');
    await user.type(screen.getByLabelText(/email/i), 'alice@example.com');
    await user.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() =>
      expect((screen.getByLabelText(/name/i) as HTMLInputElement).value).toBe('')
    );
  });

  // ── Submit — error path ─────────────────────────────────────────────────────

  it('shows API error message when service returns 422', async () => {
    const mockService = buildMockUserService({
      createUser: vi.fn().mockReturnValue(
        throwError(() => ({ error: { message: 'Email already taken' } }))
      ),
    });
    const user = userEvent.setup();
    await render(UserFormComponent, {
      providers: [{ provide: UserService, useValue: mockService }],
    });

    await user.type(screen.getByLabelText(/name/i),  'Alice');
    await user.type(screen.getByLabelText(/email/i), 'alice@example.com');
    await user.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Email already taken')
    );
  });

  it('shows fallback message when error has no message body', async () => {
    const mockService = buildMockUserService({
      createUser: vi.fn().mockReturnValue(throwError(() => ({}))),
    });
    const user = userEvent.setup();
    await render(UserFormComponent, {
      providers: [{ provide: UserService, useValue: mockService }],
    });

    await user.type(screen.getByLabelText(/name/i),  'Alice');
    await user.type(screen.getByLabelText(/email/i), 'alice@example.com');
    await user.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/failed to create user/i)
    );
  });

  it('re-enables submit button after API error', async () => {
    const mockService = buildMockUserService({
      createUser: vi.fn().mockReturnValue(throwError(() => ({}))),
    });
    const user = userEvent.setup();
    await render(UserFormComponent, {
      providers: [{ provide: UserService, useValue: mockService }],
    });

    await user.type(screen.getByLabelText(/name/i),  'Alice');
    await user.type(screen.getByLabelText(/email/i), 'alice@example.com');
    await user.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /submit/i })).toBeEnabled()
    );
  });

  // ── Cancel ──────────────────────────────────────────────────────────────────

  it('emits cancelled event when Cancel is clicked', async () => {
    const user     = userEvent.setup();
    const emitSpy  = vi.fn();

    const { fixture } = await render(UserFormComponent, {
      providers: [{ provide: UserService, useValue: buildMockUserService() }],
    });
    fixture.componentInstance.cancelled.subscribe(emitSpy);

    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(emitSpy).toHaveBeenCalledOnce();
  });

  it('clears form values when Cancel is clicked', async () => {
    const user = userEvent.setup();
    await render(UserFormComponent, {
      providers: [{ provide: UserService, useValue: buildMockUserService() }],
    });

    await user.type(screen.getByLabelText(/name/i),  'Temp Name');
    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect((screen.getByLabelText(/name/i) as HTMLInputElement).value).toBe('');
  });
});

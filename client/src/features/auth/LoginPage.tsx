import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { useAuth } from './auth-context';
import { describeAuthError, describeOAuthError } from './form-errors';
import { GoogleSection } from './GoogleSection';

const schema = z.object({
  email: z.string().trim().min(1, 'Enter your email').email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});
type Values = z.infer<typeof schema>;
const FIELDS = ['email', 'password'] as const;

export function LoginPage() {
  const { signIn } = useAuth();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  const redirectError = describeOAuthError(searchParams.get('error'));

  // On success the sign-in gate sees the new session and moves the person to where they were going.
  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await signIn(values);
    } catch (error) {
      const result = describeAuthError(error, FIELDS);
      FIELDS.forEach((field) => {
        const message = result.fields[field];
        if (message) setError(field, { type: 'server', message });
      });
      setFormError(result.message);
    }
  });

  return (
    <>
      <h1 className="font-display text-3xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-1 text-fg-muted">Pick up where you left off.</p>

      <div className="mt-8 space-y-5">
        {redirectError && <Alert>{redirectError}</Alert>}
        <GoogleSection />

        <form noValidate onSubmit={onSubmit} className="space-y-4">
          {formError && <Alert>{formError}</Alert>}

          <Field label="Email" htmlFor="email" error={errors.email?.message}>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              autoFocus
              invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? 'email-error' : undefined}
              {...register('email')}
            />
          </Field>

          <Field label="Password" htmlFor="password" error={errors.password?.message}>
            <PasswordInput
              id="password"
              autoComplete="current-password"
              invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? 'password-error' : undefined}
              {...register('password')}
            />
          </Field>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={isSubmitting}
            className="w-full"
          >
            Sign in
          </Button>
        </form>

        <p className="text-fg-muted">
          New to Daybook?{' '}
          <Link
            to="/register"
            state={location.state}
            className="font-medium text-accent underline underline-offset-2"
          >
            Create an account
          </Link>
        </p>
      </div>
    </>
  );
}

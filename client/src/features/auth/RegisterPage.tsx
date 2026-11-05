import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation } from 'react-router-dom';
import { z } from 'zod';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { useAuth } from './auth-context';
import { describeAuthError } from './form-errors';
import { GoogleSection } from './GoogleSection';

const schema = z.object({
  name: z.string().trim().min(1, 'Enter your name').max(80, 'Use 80 characters or fewer'),
  email: z.string().trim().min(1, 'Enter your email').email('Enter a valid email address'),
  password: z
    .string()
    .min(10, 'Use at least 10 characters')
    .max(128, 'Use 128 characters or fewer'),
});
type Values = z.infer<typeof schema>;
const FIELDS = ['name', 'email', 'password'] as const;

export function RegisterPage() {
  const { signUp } = useAuth();
  const location = useLocation();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await signUp(values);
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
      <h1 className="font-display text-3xl font-semibold tracking-tight">Create your account</h1>
      <p className="mt-1 text-fg-muted">It takes a minute, and you land on your overview.</p>

      <div className="mt-8 space-y-5">
        <GoogleSection />

        <form noValidate onSubmit={onSubmit} className="space-y-4">
          {formError && <Alert>{formError}</Alert>}

          <Field label="Name" htmlFor="name" error={errors.name?.message}>
            <Input
              id="name"
              autoComplete="name"
              autoFocus
              invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? 'name-error' : undefined}
              {...register('name')}
            />
          </Field>

          <Field label="Email" htmlFor="email" error={errors.email?.message}>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? 'email-error' : undefined}
              {...register('email')}
            />
          </Field>

          <Field
            label="Password"
            htmlFor="password"
            hint="At least 10 characters. A few unrelated words make a strong one."
            error={errors.password?.message}
          >
            <PasswordInput
              id="password"
              autoComplete="new-password"
              invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? 'password-error' : 'password-hint'}
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
            Create account
          </Button>
        </form>

        <p className="text-fg-muted">
          Already have an account?{' '}
          <Link
            to="/login"
            state={location.state}
            className="font-medium text-accent underline underline-offset-2"
          >
            Sign in
          </Link>
        </p>
      </div>
    </>
  );
}

'use client';

import { useActionState, useState } from 'react';
import { signIn, signUp, type AuthState } from './actions';

const initialState: AuthState = { error: null };

export default function LoginPage() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const action = mode === 'signin' ? signIn : signUp;
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-8 px-6 py-12">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-brand">Handdown</h1>
        <p className="mt-1 text-sm text-muted">
          {mode === 'signin' ? 'Welcome back' : 'Create your account'}
        </p>
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        {mode === 'signup' && (
          <Field label="Full name">
            <input
              name="fullName"
              type="text"
              autoComplete="name"
              required
              className="input"
              placeholder="Jamie Chen"
            />
          </Field>
        )}

        <Field label="Email">
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            className="input"
            placeholder="you@berkeley.edu"
          />
        </Field>

        <Field label="Password">
          <input
            name="password"
            type="password"
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            required
            minLength={6}
            className="input"
            placeholder="••••••••"
          />
        </Field>

        {state.error && (
          <p role="alert" className="text-sm text-red-600">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="mt-2 rounded-lg bg-brand px-4 py-2.5 font-medium text-white transition-colors hover:bg-brand-light disabled:opacity-60"
        >
          {pending
            ? 'Please wait…'
            : mode === 'signin'
              ? 'Sign in'
              : 'Sign up'}
        </button>
      </form>

      <p className="text-center text-sm text-muted">
        {mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}{' '}
        <button
          type="button"
          onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
          className="font-medium text-brand hover:underline"
        >
          {mode === 'signin' ? 'Sign up' : 'Sign in'}
        </button>
      </p>
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
      {label}
      {children}
    </label>
  );
}

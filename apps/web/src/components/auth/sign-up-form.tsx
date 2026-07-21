"use client"

import { authClient } from "@crikket/auth/client"
import { env } from "@crikket/env/web"
import { Icons } from "@crikket/ui/components/icons"
import { Loader } from "@crikket/ui/components/loader"
import { Button } from "@crikket/ui/components/ui/button"
import { Field, FieldError, FieldLabel } from "@crikket/ui/components/ui/field"
import { Input } from "@crikket/ui/components/ui/input"
import { useForm } from "@tanstack/react-form"
import { KeyRound } from "lucide-react"
import Link from "next/link"
import { useRouter } from "nextjs-toploader/app"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { AuthShell } from "@/components/auth/auth-shell"
import { AUTH_MIN_PASSWORD_LENGTH, getAuthErrorMessage } from "@/lib/auth"
import { registerFormSchema } from "@/lib/schema/auth"
import { client } from "@/utils/orpc"

export function SignUpForm() {
  const router = useRouter()
  const { data: session, isPending } = authClient.useSession()
  const [publicAuthConfig, setPublicAuthConfig] = useState<{
    isGoogleAuthEnabled: boolean
    isCustomOidcEnabled: boolean
    customOidcProviderName: string
  } | null>(null)

  useEffect(() => {
    client.auth.getPublicConfig().then(setPublicAuthConfig).catch(() => null)
  }, [])

  const [isSocialSignInPending, setIsSocialSignInPending] = useState(false)
  const isGoogleAuthEnabled =
    publicAuthConfig?.isGoogleAuthEnabled ?? env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED
  const isOidcEnabled =
    publicAuthConfig?.isCustomOidcEnabled ?? env.NEXT_PUBLIC_CUSTOM_OIDC_ENABLED
  const oidcProviderName =
    publicAuthConfig?.customOidcProviderName ??
    env.NEXT_PUBLIC_CUSTOM_OIDC_PROVIDER_NAME ??
    "SSO"
  const hasSocialAuth = isGoogleAuthEnabled || isOidcEnabled

  const form = useForm({
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
    validators: {
      onChange: registerFormSchema,
    },
    onSubmit: async ({ value }) => {
      const result = await authClient.signUp
        .email({
          name: value.name,
          email: value.email,
          password: value.password,
          callbackURL: env.NEXT_PUBLIC_APP_URL,
        })
        .catch(() => null)

      if (!result) {
        toast.error("Unable to reach the auth server. Please try again.")
        return
      }

      if (result.error) {
        toast.error(getAuthErrorMessage(result.error))
        return
      }

      if (result.data?.token) {
        toast.success("Account created successfully.")
        router.push("/")
        return
      }

      toast.success("Account created. Sign in to continue.")
      router.push(`/login?email=${encodeURIComponent(value.email)}`)
    },
  })

  useEffect(() => {
    if (session) {
      router.replace("/")
    }
  }, [router, session])

  const handleGoogleSignIn = async () => {
    setIsSocialSignInPending(true)

    const result = await authClient.signIn
      .social({
        provider: "google",
        callbackURL: env.NEXT_PUBLIC_APP_URL,
      })
      .catch(() => null)

    if (!result) {
      toast.error("Unable to reach the auth server. Please try again.")
      setIsSocialSignInPending(false)
      return
    }

    if (result.error) {
      toast.error(getAuthErrorMessage(result.error))
    }

    setIsSocialSignInPending(false)
  }

  const handleOidcSignIn = async () => {
    setIsSocialSignInPending(true)

    const result = await authClient.signIn
      .oauth2({
        providerId: "custom-oidc",
        callbackURL: env.NEXT_PUBLIC_APP_URL,
      })
      .catch(() => null)

    if (!result) {
      toast.error("Unable to reach the auth server. Please try again.")
      setIsSocialSignInPending(false)
      return
    }

    if (result.error) {
      toast.error(getAuthErrorMessage(result.error))
    }

    setIsSocialSignInPending(false)
  }

  if (isPending) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader />
      </div>
    )
  }

  if (session) {
    return null
  }

  return (
    <AuthShell
      description="Create your account to get started"
      title="Create account"
    >
      {hasSocialAuth ? (
        <>
          <div className="grid gap-3">
            {isGoogleAuthEnabled ? (
              <Button
                className="h-12 w-full font-semibold text-base shadow-sm transition-all hover:bg-muted/50 hover:shadow-md active:scale-[0.98]"
                disabled={isSocialSignInPending || form.state.isSubmitting}
                onClick={handleGoogleSignIn}
                type="button"
                variant="outline"
              >
                <Icons.google className="mr-3 h-5 w-5" />
                Continue with Google
              </Button>
            ) : null}
            {isOidcEnabled ? (
              <Button
                className="h-12 w-full font-semibold text-base shadow-sm transition-all hover:bg-muted/50 hover:shadow-md active:scale-[0.98]"
                disabled={isSocialSignInPending || form.state.isSubmitting}
                onClick={handleOidcSignIn}
                type="button"
                variant="outline"
              >
                <KeyRound className="mr-3 h-5 w-5" />
                Continue with {oidcProviderName}
              </Button>
            ) : null}
          </div>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-muted border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 font-medium text-muted-foreground">
                Or continue with email
              </span>
            </div>
          </div>
        </>
      ) : null}

      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          event.stopPropagation()
          form.handleSubmit()
        }}
      >
        <form.Field name="name">
          {(field) => {
            const isInvalid =
              field.state.meta.isTouched && field.state.meta.errors.length > 0

            return (
              <Field data-invalid={isInvalid}>
                <FieldLabel htmlFor={field.name}>Name</FieldLabel>
                <Input
                  aria-invalid={isInvalid}
                  autoComplete="name"
                  id={field.name}
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="Your name"
                  required
                  value={field.state.value}
                />
                {isInvalid ? (
                  <FieldError errors={field.state.meta.errors} />
                ) : null}
              </Field>
            )
          }}
        </form.Field>

        <form.Field name="email">
          {(field) => {
            const isInvalid =
              field.state.meta.isTouched && field.state.meta.errors.length > 0

            return (
              <Field data-invalid={isInvalid}>
                <FieldLabel htmlFor={field.name}>Email</FieldLabel>
                <Input
                  aria-invalid={isInvalid}
                  autoComplete="email"
                  id={field.name}
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="you@example.com"
                  required
                  type="email"
                  value={field.state.value}
                />
                {isInvalid ? (
                  <FieldError errors={field.state.meta.errors} />
                ) : null}
              </Field>
            )
          }}
        </form.Field>

        <form.Field name="password">
          {(field) => {
            const isInvalid =
              field.state.meta.isTouched && field.state.meta.errors.length > 0

            return (
              <Field data-invalid={isInvalid}>
                <FieldLabel htmlFor={field.name}>Password</FieldLabel>
                <Input
                  aria-invalid={isInvalid}
                  autoComplete="new-password"
                  id={field.name}
                  minLength={AUTH_MIN_PASSWORD_LENGTH}
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="••••••••"
                  required
                  type="password"
                  value={field.state.value}
                />
                <p className="text-muted-foreground text-xs">
                  Use at least {AUTH_MIN_PASSWORD_LENGTH} characters.
                </p>
                {isInvalid ? (
                  <FieldError errors={field.state.meta.errors} />
                ) : null}
              </Field>
            )
          }}
        </form.Field>

        <form.Field name="confirmPassword">
          {(field) => {
            const isInvalid =
              field.state.meta.isTouched && field.state.meta.errors.length > 0

            return (
              <Field data-invalid={isInvalid}>
                <FieldLabel htmlFor={field.name}>Confirm password</FieldLabel>
                <Input
                  aria-invalid={isInvalid}
                  autoComplete="new-password"
                  id={field.name}
                  minLength={AUTH_MIN_PASSWORD_LENGTH}
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="••••••••"
                  required
                  type="password"
                  value={field.state.value}
                />
                {isInvalid ? (
                  <FieldError errors={field.state.meta.errors} />
                ) : null}
              </Field>
            )
          }}
        </form.Field>

        <Button
          className="h-11 w-full font-semibold"
          disabled={form.state.isSubmitting || isSocialSignInPending}
          type="submit"
        >
          {form.state.isSubmitting ? "Creating account..." : "Sign up"}
        </Button>
      </form>

      <p className="text-center text-muted-foreground text-sm">
        Already have an account?{" "}
        <Link
          className="font-medium text-foreground hover:underline"
          href="/login"
        >
          Sign in
        </Link>
      </p>
    </AuthShell>
  )
}

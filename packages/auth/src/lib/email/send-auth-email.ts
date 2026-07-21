import { env } from "@crikket/env/server"
import { render } from "@react-email/render"
import type { ReactElement } from "react"
import { Resend } from "resend"
import nodemailer from "nodemailer"

type SendAuthEmailInput = {
  to: string
  subject: string
  text: string
  react: ReactElement
}

const resendClient = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null
const smtpConfigured = Boolean(env.SMTP_HOST)
const smtpTransporter = smtpConfigured
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT ?? 587,
      auth: (env.SMTP_USER && env.SMTP_PASSWORD) ? {
        user: env.SMTP_USER,
        pass: env.SMTP_PASSWORD,
      } : undefined,
    })
  : null

const fromName = "Crikket"

export const sendAuthEmail = async ({
  to,
  subject,
  text,
  react,
}: SendAuthEmailInput): Promise<void> => {
  const html = await render(react)
  
  if (smtpTransporter) {
    const fromEmail = env.SMTP_FROM_EMAIL || env.RESEND_FROM_EMAIL
    if (!fromEmail) {
      throw new Error(
        "Missing SMTP_FROM_EMAIL. Set SMTP_FROM_EMAIL or RESEND_FROM_EMAIL in apps/server/.env."
      )
    }

    try {
      await smtpTransporter.sendMail({
        from: `${fromName} <${fromEmail}>`,
        to,
        subject,
        text,
        html,
      })
      return
    } catch (error) {
      throw new Error(`Failed to send auth email via SMTP: ${(error as Error).message}`)
    }
  }

  if (resendClient) {
    const fromEmail = env.RESEND_FROM_EMAIL
    if (!fromEmail) {
      throw new Error(
        "Missing RESEND_FROM_EMAIL. Set RESEND_FROM_EMAIL in apps/server/.env."
      )
    }

    const { error } = await resendClient.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to,
      subject,
      html,
      text,
    })

    if (error) {
      throw new Error(`Failed to send auth email via Resend: ${error.message}`)
    }
    return
  }

  if (env.NODE_ENV === "production") {
    throw new Error(
      "Missing email configuration. Set SMTP variables or RESEND_API_KEY in apps/server/.env."
    )
  }

  console.warn(
    `[email] Missing email configuration in apps/server/.env. Skipping email delivery for ${to}.`
  )
}

import { sendEmailVerificationOtpStrictProcedure } from "@crikket/auth/procedures/email-otp"
import { getPublicAuthConfigProcedure } from "@crikket/auth/procedures/get-public-config"

export const authRouter = {
  getPublicConfig: getPublicAuthConfigProcedure,
  sendEmailVerificationOtpStrict: sendEmailVerificationOtpStrictProcedure,
}

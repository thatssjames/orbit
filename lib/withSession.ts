import { withIronSessionApiRoute, withIronSessionSsr } from "iron-session/next";
import * as crypto from "crypto";
import zxcvbn from 'zxcvbn';
import {
  GetServerSidePropsContext,
  GetServerSidePropsResult,
  NextApiHandler,
} from "next";

if (process.env.NODE_ENV === 'production') {
  // if (!process.env.SESSION_SECRET) {
  //   throw new Error('SESSION_SECRET environment variable is must be required to be set in production');
  // }
  
  const secret = process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");
  
  // disallow the default password
  if (secret === 'supersecretpassword') {
    throw new Error('SESSION_SECRET must be changed from the default secret in production');
  }

  // Stregnth
  const strength = zxcvbn(secret);
  if (strength.score < 4) { 
    throw new Error(
      `SESSION_SECRET is not strong enough. Score: ${strength.score}/4. Please generate a secret, e.g using "openssl rand -base64 32" or use a password manager to generate a secure password.`
    );
  }
}

const code = process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");

const sessionOptions = {
  password: code,
  cookieName: "tovy_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 24 * 7, // 1 week
    path: '/',
    domain: process.env.NODE_ENV === 'production' ? process.env.COOKIE_DOMAIN : undefined,
  },
  ttl: 60 * 60 * 24 * 7, // 1 week
};

export function withSessionRoute(handler: NextApiHandler) {
  return withIronSessionApiRoute(handler, sessionOptions);
}

// Theses types are compatible with InferGetStaticPropsType https://nextjs.org/docs/basic-features/data-fetching#typescript-use-getstaticprops
export function withSessionSsr<
  P extends { [key: string]: unknown } = { [key: string]: unknown },
>(
  handler: (
    context: GetServerSidePropsContext,
  ) => GetServerSidePropsResult<P> | Promise<GetServerSidePropsResult<P>>,
) {
  return withIronSessionSsr(handler, sessionOptions);
}
import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import Credentials from 'next-auth/providers/credentials'
import Facebook from 'next-auth/providers/facebook'
import type { Provider } from 'next-auth/providers'

const providers: Provider[] = [
  Google({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  }),
  Credentials({
    credentials: {
      email: { label: 'Email Address', type: 'email' },
      password: { label: 'Password', type: 'password' },
    },
    authorize(c) {
      if (c.password !== 'password') {
        return null
      }
      return {
        id: 'test',
        name: 'Test User',
        email: String(c.email),
      }
    },
  }),

  Facebook({
    clientId: process.env.FACEBOOK_CLIENT_ID,
    clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
  }),
]

if (!process.env.GOOGLE_CLIENT_ID) {
  console.warn('Missing environment variable "GOOGLE_CLIENT_ID"')
}
if (!process.env.GOOGLE_CLIENT_SECRET) {
  console.warn('Missing environment variable "GOOGLE_CLIENT_SECRET"')
}
if (!process.env.FACEBOOK_CLIENT_ID) {
  console.warn('Missing environment variable "FACEBOOK_CLIENT_ID"')
}
if (!process.env.FACEBOOK_CLIENT_SECRET) {
  console.warn('Missing environment variable "FACEBOOK_CLIENT_SECRET"')
}

export const providerMap = providers.map((provider) => {
  if (typeof provider === 'function') {
    const providerData = provider()
    return { id: providerData.id, name: providerData.name }
  }
  return { id: provider.id, name: provider.name }
})

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,

  secret: process.env.AUTH_SECRET,
  pages: {
    signIn: '/auth/signin',
  },
  callbacks: {
    authorized({ auth: session, request: { nextUrl } }) {
      const isLoggedIn = !!session?.user
      const isPublicPage = nextUrl.pathname.startsWith('/public')

      if (isPublicPage || isLoggedIn) {
        return true
      }

      return false // Redirect unauthenticated users to login page
    },
  },
})

import { providerMap } from '@/auth.ts'
import { SignInPage } from '@toolpad/core/SignInPage'
import signIn from './actions.ts'

export default function SignIn() {
  return <SignInPage providers={providerMap} signIn={signIn} />
}

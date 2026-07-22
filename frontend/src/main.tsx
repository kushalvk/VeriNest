import { StrictMode, type ReactElement } from 'react'
import { createRoot } from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { GoogleReCaptchaProvider } from 'react-google-recaptcha-v3'
import './index.css'
import App from './App.tsx'

// Same OAuth 2.0 Web Client ID as the backend's GOOGLE_CLIENT_ID, baked in at
// build time. When it is unset we skip the provider entirely and the Google
// sign-in buttons hide themselves (see GoogleSignInButton) — the app still runs
// with email/password auth only, never crashing on a missing key.
const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined

// reCAPTCHA v3 site key (public pair of the backend's RECAPTCHA_SECRET_KEY —
// the secret itself must never appear in any VITE_ variable). Unset → no
// provider, forms submit without a token and the backend's dev fallback
// applies. The provider shows Google's badge bottom-right; it must stay
// visible per Google's terms of use — reposition if needed, never hide.
const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY as string | undefined

let tree: ReactElement = <App />
if (recaptchaSiteKey) {
  tree = <GoogleReCaptchaProvider reCaptchaKey={recaptchaSiteKey}>{tree}</GoogleReCaptchaProvider>
}
if (googleClientId) {
  tree = <GoogleOAuthProvider clientId={googleClientId}>{tree}</GoogleOAuthProvider>
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>{tree}</StrictMode>,
)

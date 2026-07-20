import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google'
import './index.css'
import App from './App.tsx'

// Same OAuth 2.0 Web Client ID as the backend's GOOGLE_CLIENT_ID, baked in at
// build time. When it is unset we skip the provider entirely and the Google
// sign-in buttons hide themselves (see GoogleSignInButton) — the app still runs
// with email/password auth only, never crashing on a missing key.
const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {googleClientId ? (
      <GoogleOAuthProvider clientId={googleClientId}>
        <App />
      </GoogleOAuthProvider>
    ) : (
      <App />
    )}
  </StrictMode>,
)

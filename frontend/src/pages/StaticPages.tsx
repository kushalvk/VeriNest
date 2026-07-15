import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

/**
 * The lightweight informational pages linked from the Header/Footer
 * (About, Services, Contact, Privacy, Terms). One shared shell keeps them
 * visually identical; content stays intentionally brief until a dedicated
 * marketing pass fleshes them out.
 */
function InfoPage({ title, lede, children }: { title: string; lede: string; children: ReactNode }) {
  return (
    <main className="pb-16">
      <section className="border-b border-line bg-surface">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
          <h1 className="text-3xl font-bold tracking-tight text-ink">{title}</h1>
          <p className="mt-3 text-base leading-relaxed text-ink-muted">{lede}</p>
        </div>
      </section>
      <div className="mx-auto mt-8 max-w-3xl space-y-6 px-4 sm:px-6">{children}</div>
    </main>
  );
}

function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="rounded-lg bg-surface p-6 shadow-card">
      {title && <h2 className="text-lg font-semibold text-ink">{title}</h2>}
      <div className={`${title ? 'mt-2 ' : ''}space-y-3 text-sm leading-relaxed text-ink-muted`}>
        {children}
      </div>
    </section>
  );
}

export function AboutPage() {
  return (
    <InfoPage title="About VeriNest"
      lede="VeriNest exists to remove the guesswork from renting: landlords shouldn't have to gamble on strangers, and reliable tenants shouldn't have to prove themselves from scratch with every application.">
      <Card title="What we do">
        <p>
          VeriNest is a digital tenant verification platform. Tenants build a verified
          profile once — identity and income documents, checked through an OCR-assisted
          review pipeline — and share it with landlords on their own terms through
          secure, time-limited access links.
        </p>
        <p>
          Landlords see an explainable trust score instead of a stack of unverifiable
          paperwork, and the whole journey from application to a digitally signed rental
          agreement happens in one place.
        </p>
      </Card>
      <Card title="Our principles">
        <p><strong className="text-ink">Consent first.</strong> Documents are never visible to anyone until the tenant explicitly approves a request, and access expires automatically.</p>
        <p><strong className="text-ink">Explainable trust.</strong> Every trust score comes with the exact reasons it was awarded — no black-box judgments.</p>
        <p><strong className="text-ink">Both sides matter.</strong> Tenants rate landlords just as landlords rate tenants; reputation on VeriNest is mutual.</p>
      </Card>
      <Card>
        <p>
          VeriNest is currently an academic project built as part of an M.Sc. IT program —
          feedback is very welcome via the <Link to="/contact" className="font-medium text-primary-600 hover:underline">contact page</Link>.
        </p>
      </Card>
    </InfoPage>
  );
}

export function ServicesPage() {
  return (
    <InfoPage title="What we offer"
      lede="Everything both sides of a tenancy need — from the first application to the final rating.">
      <Card title="For tenants">
        <p>• Upload identity and income documents once; get them verified and reuse them for every application.</p>
        <p>• A transparent trust score that grows with verified documents, a complete profile, and good rental history.</p>
        <p>• Apply to listings, track application status, and control exactly who sees your documents and for how long.</p>
      </Card>
      <Card title="For landlords">
        <p>• List properties and receive applications from tenants with verified profiles.</p>
        <p>• Request document access with tenant consent — one-time, 24-hour, or 7-day windows.</p>
        <p>• Generate rental agreements, collect digital signatures, and keep a stamped PDF record.</p>
      </Card>
      <Card title="For everyone">
        <p>• Email and in-app notifications at every step of the journey.</p>
        <p>• Post-tenancy two-way ratings that build lasting, portable reputations.</p>
        <p>• An in-app assistant that answers questions about your own account and data.</p>
      </Card>
    </InfoPage>
  );
}

export function ContactPage() {
  return (
    <InfoPage title="Contact us"
      lede="Questions, feedback, or something not working as it should? We'd like to hear about it.">
      <Card title="Reach the team">
        <p>
          Email us at{' '}
          <a href="mailto:kushalvaghela2003@gmail.com" className="font-medium text-primary-600 hover:underline">
            kushalvaghela2003@gmail.com
          </a>{' '}
          and we'll get back to you as soon as we can.
        </p>
        <p>
          Signed-in users can also ask the in-app assistant (the chat bubble in the
          corner) about their own account, applications, and trust score.
        </p>
      </Card>
      <Card title="Common questions">
        <p><strong className="text-ink">A document was rejected — what now?</strong> Check the reviewer remarks on your Documents page and upload a clearer copy; it re-enters review automatically.</p>
        <p><strong className="text-ink">Who can see my documents?</strong> Only landlords you explicitly approve, through expiring access links. Nothing is shared without your consent.</p>
        <p><strong className="text-ink">How is my trust score calculated?</strong> From verified documents, profile completeness, and landlord ratings — the score page lists every contributing reason.</p>
      </Card>
    </InfoPage>
  );
}

export function PrivacyPage() {
  return (
    <InfoPage title="Privacy Policy"
      lede="What VeriNest collects, why, and the rules the platform holds itself to. (VeriNest is an academic project; this policy describes how the platform is designed to behave.)">
      <Card title="What we collect">
        <p>Account details (name, email, role), profile information you provide, documents you upload for verification, property listings, applications, agreements, and ratings.</p>
      </Card>
      <Card title="How it's used">
        <p>Solely to operate the platform: verifying documents, computing your trust score, notifying you about activity on your account, and generating rental agreements. Your data is never sold or used for advertising.</p>
      </Card>
      <Card title="Who can see your documents">
        <p>Only platform reviewers (for verification) and landlords you explicitly approve, through time-limited access links that expire automatically. Emails never contain documents or sensitive numbers — they always link back to the platform.</p>
      </Card>
      <Card title="Security">
        <p>Passwords are stored hashed, sessions use short-lived tokens, document access links are single-use or time-boxed, and sensitive actions are recorded in an audit log.</p>
      </Card>
      <Card title="Your choices">
        <p>You can update your profile at any time and decline any document access request. To have your data removed, contact us via the <Link to="/contact" className="font-medium text-primary-600 hover:underline">contact page</Link>.</p>
      </Card>
    </InfoPage>
  );
}

export function TermsPage() {
  return (
    <InfoPage title="Terms of Service"
      lede="The ground rules for using VeriNest. (VeriNest is an academic project; these terms are illustrative rather than a binding legal document.)">
      <Card title="Your account">
        <p>Keep your credentials to yourself and provide truthful information. Uploading forged or tampered documents is grounds for immediate removal and will be flagged by our fraud checks.</p>
      </Card>
      <Card title="Acceptable use">
        <p>Use the platform only for genuine rental activity. Don't attempt to access other users' data, misuse document access links, or harass other members through applications, messages, or reviews.</p>
      </Card>
      <Card title="Agreements and ratings">
        <p>Digitally signed agreements generated here record the mutual intent of both parties; consult a legal professional for jurisdiction-specific enforceability. Ratings must reflect honest experience of an actual tenancy.</p>
      </Card>
      <Card title="Liability">
        <p>VeriNest verifies documents on a best-effort basis and provides information to help both parties decide — the final decision to rent, and the tenancy itself, remain between tenant and landlord.</p>
      </Card>
    </InfoPage>
  );
}

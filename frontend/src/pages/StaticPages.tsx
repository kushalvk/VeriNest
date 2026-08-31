import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
    ArrowRight,
    BadgeCheck,
    CheckCircle2,
    FileCheck2,
    KeyRound,
    Mail,
    MessageCircle,
    ShieldCheck,
    Sparkles,
    UserCheck,
} from 'lucide-react';

import { PhotoBand, PhotoSplit } from '../components/Imagery';
import { photos } from '../assets/photos';
import type { Photo } from '../assets/photos';


/* ================================================================
   SHARED INFO PAGE
================================================================ */

function InfoPage({
                      title,
                      lede,
                      photo,
                      wide,
                      children,
                  }: {
    title: string;
    lede: string;
    photo?: Photo;
    wide?: boolean;
    children: ReactNode;
}) {

    const header = photo ? (
        <section className="relative isolate overflow-hidden">

            <PhotoBand photo={photo} scrim="hero" eager>

                <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:py-28">

                    <div className="max-w-3xl">

                        {/* Eyebrow */}
                        <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-white shadow-lg backdrop-blur-md">

                            <Sparkles className="h-4 w-4" />

                            VeriNest

                        </div>


                        {/* Heading */}
                        <h1 className="mt-6 text-4xl font-black leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
                            {title}
                        </h1>


                        {/* Description */}
                        <p className="mt-5 max-w-2xl text-base leading-7 text-slate-200 sm:text-lg">
                            {lede}
                        </p>


                        {/* Trust indicators */}
                        <div className="mt-7 flex flex-wrap gap-x-6 gap-y-3 text-sm text-white/80">

              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                Transparent renting
              </span>

                            <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                Built around trust
              </span>

                            <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                Tenant focused
              </span>

                        </div>

                    </div>

                </div>

            </PhotoBand>

            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-slate-50 to-transparent dark:from-slate-950" />

        </section>

    ) : (

        /* ============================================================
           TEXT-ONLY HERO
           Used for Privacy / Terms
        ============================================================ */
        <section className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-br from-slate-50 via-white to-primary-50 dark:border-white/10 dark:from-slate-950 dark:via-slate-950 dark:to-primary-950/30">

            <div className="absolute -right-32 -top-32 h-80 w-80 rounded-full bg-primary-500/10 blur-3xl" />

            <div className="absolute -bottom-32 -left-32 h-80 w-80 rounded-full bg-indigo-500/10 blur-3xl" />

            <div className="relative mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:py-20">

                <div className="max-w-3xl">

                    <div className="inline-flex items-center gap-2 rounded-full border border-primary-200 bg-primary-50 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-primary-700 dark:border-primary-500/20 dark:bg-primary-500/10 dark:text-primary-300">

                        <ShieldCheck className="h-4 w-4" />

                        VeriNest

                    </div>

                    <h1 className="mt-6 text-4xl font-black tracking-tight text-slate-900 dark:text-white sm:text-5xl">
                        {title}
                    </h1>

                    <p className="mt-5 max-w-2xl text-base leading-7 text-slate-500 dark:text-slate-400 sm:text-lg">
                        {lede}
                    </p>

                </div>

            </div>

        </section>
    );


    return (
        <main className="min-h-screen overflow-hidden bg-slate-50 pb-20 dark:bg-slate-950">

            {header}


            {/* ==========================================================
          CONTENT
      =========================================================== */}
            <div
                className={`relative mx-auto mt-10 px-4 sm:px-6 ${
                    wide
                        ? 'max-w-6xl space-y-16'
                        : 'max-w-4xl space-y-6'
                }`}
            >
                {children}
            </div>

        </main>
    );
}


/* ================================================================
   PREMIUM CARD
================================================================ */

function Card({
                  title,
                  icon: Icon,
                  eyebrow,
                  children,
              }: {
    title?: string;
    icon?: typeof ShieldCheck;
    eyebrow?: string;
    children: ReactNode;
}) {
    return (
        <section className="group relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-7 shadow-[0_15px_45px_rgba(15,23,42,0.07)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_55px_rgba(15,23,42,0.10)] dark:border-white/10 dark:bg-slate-900">

            {/* Decorative glow */}
            <div className="pointer-events-none absolute -right-16 -top-16 h-32 w-32 rounded-full bg-primary-500/5 blur-3xl transition group-hover:bg-primary-500/10" />


            <div className="relative">

                {Icon && (
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-50 to-indigo-100 text-primary-600 ring-1 ring-primary-100 dark:from-primary-500/10 dark:to-indigo-500/10 dark:text-primary-300 dark:ring-primary-500/20">

                        <Icon className="h-6 w-6" />

                    </div>
                )}


                {eyebrow && (
                    <p className={`${Icon ? 'mt-5' : ''} text-[10px] font-black uppercase tracking-[0.18em] text-primary-600 dark:text-primary-400`}>
                        {eyebrow}
                    </p>
                )}


                {title && (
                    <h2 className={`${Icon || eyebrow ? 'mt-2' : ''} text-xl font-black tracking-tight text-slate-900 dark:text-white`}>
                        {title}
                    </h2>
                )}


                <div
                    className={`${title || Icon || eyebrow ? 'mt-4' : ''} space-y-4 text-sm leading-7 text-slate-500 dark:text-slate-400`}
                >
                    {children}
                </div>

            </div>

        </section>
    );
}


/* ================================================================
   SERVICE LIST
================================================================ */

function ServiceList({
                         title,
                         items,
                         icon: Icon,
                     }: {
    title: string;
    items: string[];
    icon: typeof ShieldCheck;
}) {

    return (
        <div>

            <div className="flex items-center gap-4">

                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-50 to-indigo-100 text-primary-600 dark:from-primary-500/10 dark:to-indigo-500/10 dark:text-primary-300">

                    <Icon className="h-6 w-6" />

                </div>

                <div>

                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary-600 dark:text-primary-400">
                        VeriNest service
                    </p>

                    <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                        {title}
                    </h2>

                </div>

            </div>


            <ul className="mt-7 space-y-4">

                {items.map((item) => (

                    <li
                        key={item}
                        className="flex gap-3 rounded-2xl border border-slate-200/70 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/[0.03]"
                    >

            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">

              <CheckCircle2 className="h-4 w-4" />

            </span>

                        <span className="text-sm leading-6 text-slate-500 dark:text-slate-400">
              {item}
            </span>

                    </li>

                ))}

            </ul>

        </div>
    );
}


/* ================================================================
   ABOUT
================================================================ */

export function AboutPage() {

    return (
        <InfoPage
            title="About VeriNest"
            photo={photos.about}
            lede="VeriNest exists to remove the guesswork from renting: landlords shouldn't have to gamble on strangers, and reliable tenants shouldn't have to prove themselves from scratch with every application."
        >

            {/* Intro */}
            <Card
                title="What we do"
                eyebrow="OUR MISSION"
                icon={ShieldCheck}
            >

                <p>
                    VeriNest is a digital tenant verification platform. Tenants build
                    a verified profile once — identity and income documents, checked
                    through an OCR-assisted review pipeline — and share it with
                    landlords on their own terms through secure, time-limited access
                    links.
                </p>

                <p>
                    Landlords see an explainable trust score instead of a stack of
                    unverifiable paperwork, and the whole journey from application to
                    a digitally signed rental agreement happens in one place.
                </p>

            </Card>


            {/* Principles */}
            <div>

                <div className="mb-7">

                    <p className="text-xs font-black uppercase tracking-[0.18em] text-primary-600 dark:text-primary-400">
                        What we believe
                    </p>

                    <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                        Principles behind VeriNest
                    </h2>

                </div>


                <div className="grid gap-5 md:grid-cols-3">

                    <Card
                        title="Consent first"
                        icon={ShieldCheck}
                    >
                        <p>
                            Documents are never visible to anyone until the tenant
                            explicitly approves a request, and access expires automatically.
                        </p>
                    </Card>


                    <Card
                        title="Explainable trust"
                        icon={BadgeCheck}
                    >
                        <p>
                            Every trust score comes with the exact reasons it was awarded —
                            no black-box judgments.
                        </p>
                    </Card>


                    <Card
                        title="Both sides matter"
                        icon={UserCheck}
                    >
                        <p>
                            Tenants rate landlords just as landlords rate tenants;
                            reputation on VeriNest is mutual.
                        </p>
                    </Card>

                </div>

            </div>


            {/* Academic project */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-primary-950 to-indigo-950 p-8 shadow-xl sm:p-10">

                <div className="absolute -right-20 -top-20 h-48 w-48 rounded-full bg-primary-500/20 blur-3xl" />

                <div className="relative">

                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-primary-300">
                        <Sparkles className="h-5 w-5" />
                    </div>

                    <h2 className="mt-5 text-xl font-black text-white">
                        An academic project with a real-world goal
                    </h2>

                    <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
                        VeriNest is currently an academic project built as part of an
                        M.Sc. IT program — feedback is very welcome via the{' '}
                        <Link
                            to="/contact"
                            className="font-bold text-primary-300 transition hover:text-white hover:underline"
                        >
                            contact page
                        </Link>.
                    </p>

                </div>

            </div>

        </InfoPage>
    );
}


/* ================================================================
   SERVICES
================================================================ */

export function ServicesPage() {

    return (
        <InfoPage
            title="What we offer"
            photo={photos.services}
            wide
            lede="Everything both sides of a tenancy need — from the first application to the final rating."
        >

            {/* Intro stats */}
            <div className="grid gap-4 sm:grid-cols-3">

                <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900">

                    <ShieldCheck className="h-6 w-6 text-primary-600 dark:text-primary-300" />

                    <p className="mt-4 text-lg font-black text-slate-900 dark:text-white">
                        Verified
                    </p>

                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Identity & income documents
                    </p>

                </div>


                <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900">

                    <BadgeCheck className="h-6 w-6 text-emerald-500" />

                    <p className="mt-4 text-lg font-black text-slate-900 dark:text-white">
                        Transparent
                    </p>

                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Explainable trust scores
                    </p>

                </div>


                <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900">

                    <FileCheck2 className="h-6 w-6 text-indigo-500" />

                    <p className="mt-4 text-lg font-black text-slate-900 dark:text-white">
                        Digital
                    </p>

                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Agreements & signatures
                    </p>

                </div>

            </div>


            {/* Tenant */}
            <PhotoSplit
                photo={photos.servicesTenant}
                side="right"
            >

                <ServiceList
                    title="For tenants"
                    icon={UserCheck}
                    items={[
                        'Upload identity and income documents once; get them verified and reuse them for every application.',
                        'A transparent trust score that grows with verified documents, a complete profile, and good rental history.',
                        'Apply to listings, track application status, and control exactly who sees your documents and for how long.',
                    ]}
                />

            </PhotoSplit>


            {/* Landlord */}
            <PhotoSplit
                photo={photos.servicesLandlord}
                side="left"
            >

                <ServiceList
                    title="For landlords"
                    icon={KeyRound}
                    items={[
                        'List properties and receive applications from tenants with verified profiles.',
                        'Request document access with tenant consent — one-time, 24-hour, or 7-day windows.',
                        'Generate rental agreements, collect digital signatures, and keep a stamped PDF record.',
                    ]}
                />

            </PhotoSplit>


            {/* Everyone */}
            <PhotoSplit
                photo={photos.servicesEveryone}
                side="right"
            >

                <ServiceList
                    title="For everyone"
                    icon={MessageCircle}
                    items={[
                        'Email and in-app notifications at every step of the journey.',
                        'Post-tenancy two-way ratings that build lasting, portable reputations.',
                        'An in-app assistant that answers questions about your own account and data.',
                    ]}
                />

            </PhotoSplit>


            {/* CTA */}
            <div className="rounded-3xl bg-gradient-to-br from-primary-600 to-indigo-700 p-8 text-center shadow-xl sm:p-10">

                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 text-white">
                    <ArrowRight className="h-6 w-6" />
                </div>

                <h2 className="mt-5 text-2xl font-black text-white">
                    Ready to explore VeriNest?
                </h2>

                <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-primary-100">
                    Browse verified rental listings or create your account and start
                    building your trusted rental profile.
                </p>

                <div className="mt-6 flex flex-wrap justify-center gap-3">

                    <Link
                        to="/properties"
                        className="inline-flex items-center rounded-xl bg-white px-6 py-3 text-sm font-bold text-primary-700 shadow-lg transition hover:-translate-y-0.5 hover:bg-primary-50"
                    >
                        Browse properties
                        <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>

                    <Link
                        to="/register"
                        className="inline-flex items-center rounded-xl border border-white/30 bg-white/10 px-6 py-3 text-sm font-bold text-white backdrop-blur transition hover:bg-white/20"
                    >
                        Create an account
                    </Link>

                </div>

            </div>

        </InfoPage>
    );
}


/* ================================================================
   CONTACT
================================================================ */

export function ContactPage() {

    return (
        <InfoPage
            title="Contact us"
            photo={photos.contact}
            lede="Questions, feedback, or something not working as it should? We'd like to hear about it."
        >

            {/* Main contact card */}
            <div className="grid gap-6 md:grid-cols-[1.3fr_0.7fr]">

                <Card
                    title="Reach the team"
                    eyebrow="GET IN TOUCH"
                    icon={Mail}
                >

                    <p>
                        Email us at{' '}
                        <a
                            href="mailto:kushalvaghela2003@gmail.com"
                            className="font-bold text-primary-600 hover:underline dark:text-primary-300"
                        >
                            kushalvaghela2003@gmail.com
                        </a>{' '}
                        and we'll get back to you as soon as we can.
                    </p>

                    <p>
                        Signed-in users can also ask the in-app assistant (the chat bubble
                        in the corner) about their own account, applications, and trust
                        score.
                    </p>

                    <Link
                        to="/"
                        className="group mt-3 inline-flex items-center text-sm font-bold text-primary-600 dark:text-primary-300"
                    >
                        Return to home

                        <ArrowRight className="ml-2 h-4 w-4 transition group-hover:translate-x-1" />

                    </Link>

                </Card>


                {/* Contact visual */}
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-primary-950 to-indigo-950 p-7 shadow-xl">

                    <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-primary-500/20 blur-3xl" />

                    <div className="relative">

                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-primary-300">
                            <MessageCircle className="h-6 w-6" />
                        </div>

                        <h2 className="mt-6 text-xl font-black text-white">
                            We're listening
                        </h2>

                        <p className="mt-3 text-sm leading-6 text-slate-300">
                            Found a problem, have an idea, or simply want to know more?
                            Your feedback helps improve VeriNest.
                        </p>

                        <div className="mt-6 flex items-center gap-2 text-xs font-bold text-emerald-300">
                            <span className="h-2 w-2 rounded-full bg-emerald-400" />
                            Support available
                        </div>

                    </div>

                </div>

            </div>


            {/* FAQ */}
            <div>

                <div className="mb-7">

                    <p className="text-xs font-black uppercase tracking-[0.18em] text-primary-600 dark:text-primary-400">
                        FAQ
                    </p>

                    <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                        Common questions
                    </h2>

                </div>


                <div className="grid gap-5 md:grid-cols-3">

                    <Card title="A document was rejected">

                        <p>
                            Check the reviewer remarks on your Documents page and upload a
                            clearer copy; it re-enters review automatically.
                        </p>

                    </Card>


                    <Card title="Who can see my documents?">

                        <p>
                            Only landlords you explicitly approve, through expiring access
                            links. Nothing is shared without your consent.
                        </p>

                    </Card>


                    <Card title="How is my trust score calculated?">

                        <p>
                            From verified documents, profile completeness, and landlord
                            ratings — the score page lists every contributing reason.
                        </p>

                    </Card>

                </div>

            </div>

        </InfoPage>
    );
}


/* ================================================================
   PRIVACY
================================================================ */

export function PrivacyPage() {

    return (
        <InfoPage
            title="Privacy Policy"
            lede="What VeriNest collects, why, and the rules the platform holds itself to. (VeriNest is an academic project; this policy describes how the platform is designed to behave.)"
        >

            <div className="rounded-2xl border border-primary-200 bg-primary-50 p-5 dark:border-primary-500/20 dark:bg-primary-500/5">

                <div className="flex gap-3">

                    <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary-600 dark:text-primary-300" />

                    <p className="text-sm leading-6 text-primary-800 dark:text-primary-200">
                        VeriNest is designed around consent, limited access, and
                        responsible handling of user data.
                    </p>

                </div>

            </div>


            <Card
                title="What we collect"
                eyebrow="01"
                icon={UserCheck}
            >
                <p>
                    Account details (name, email, role), profile information you
                    provide, documents you upload for verification, property listings,
                    applications, agreements, and ratings.
                </p>
            </Card>


            <Card
                title="How it's used"
                eyebrow="02"
                icon={ShieldCheck}
            >
                <p>
                    Solely to operate the platform: verifying documents, computing your
                    trust score, notifying you about activity on your account, and
                    generating rental agreements. Your data is never sold or used for
                    advertising.
                </p>
            </Card>


            <Card
                title="Who can see your documents"
                eyebrow="03"
                icon={KeyRound}
            >
                <p>
                    Only platform reviewers (for verification) and landlords you
                    explicitly approve, through time-limited access links that expire
                    automatically. Emails never contain documents or sensitive numbers —
                    they always link back to the platform.
                </p>
            </Card>


            <Card
                title="Security"
                eyebrow="04"
                icon={ShieldCheck}
            >
                <p>
                    Passwords are stored hashed, sessions use short-lived tokens,
                    document access links are single-use or time-boxed, and sensitive
                    actions are recorded in an audit log.
                </p>
            </Card>


            <Card
                title="Your choices"
                eyebrow="05"
                icon={CheckCircle2}
            >
                <p>
                    You can update your profile at any time and decline any document
                    access request. To have your data removed, contact us via the{' '}
                    <Link
                        to="/contact"
                        className="font-bold text-primary-600 hover:underline dark:text-primary-300"
                    >
                        contact page
                    </Link>.
                </p>
            </Card>

        </InfoPage>
    );
}


/* ================================================================
   TERMS
================================================================ */

export function TermsPage() {

    return (
        <InfoPage
            title="Terms of Service"
            lede="The ground rules for using VeriNest. (VeriNest is an academic project; these terms are illustrative rather than a binding legal document.)"
        >

            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-500/20 dark:bg-amber-500/5">

                <div className="flex gap-3">

                    <FileCheck2 className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-300" />

                    <p className="text-sm leading-6 text-amber-800 dark:text-amber-200">
                        These terms are illustrative because VeriNest is currently an
                        academic project rather than a commercial rental service.
                    </p>

                </div>

            </div>


            <Card
                title="Your account"
                eyebrow="01"
                icon={UserCheck}
            >
                <p>
                    Keep your credentials to yourself and provide truthful information.
                    Uploading forged or tampered documents is grounds for immediate
                    removal and will be flagged by our fraud checks.
                </p>
            </Card>


            <Card
                title="Acceptable use"
                eyebrow="02"
                icon={ShieldCheck}
            >
                <p>
                    Use the platform only for genuine rental activity. Don't attempt to
                    access other users' data, misuse document access links, or harass
                    other members through applications, messages, or reviews.
                </p>
            </Card>


            <Card
                title="Agreements and ratings"
                eyebrow="03"
                icon={FileCheck2}
            >
                <p>
                    Digitally signed agreements generated here record the mutual intent
                    of both parties; consult a legal professional for jurisdiction-specific
                    enforceability. Ratings must reflect honest experience of an actual
                    tenancy.
                </p>
            </Card>


            <Card
                title="Liability"
                eyebrow="04"
                icon={KeyRound}
            >
                <p>
                    VeriNest verifies documents on a best-effort basis and provides
                    information to help both parties decide — the final decision to
                    rent, and the tenancy itself, remain between tenant and landlord.
                </p>
            </Card>


            {/* Bottom navigation */}
            <div className="flex flex-col items-center justify-between gap-4 rounded-3xl border border-slate-200 bg-white p-6 sm:flex-row dark:border-white/10 dark:bg-slate-900">

                <div>

                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                        Have questions about these terms?
                    </p>

                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Our team is happy to help clarify how VeriNest works.
                    </p>

                </div>

                <Link
                    to="/contact"
                    className="group inline-flex shrink-0 items-center rounded-xl bg-primary-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-primary-600/20 transition hover:-translate-y-0.5 hover:bg-primary-700"
                >
                    Contact us

                    <ArrowRight className="ml-2 h-4 w-4 transition group-hover:translate-x-1" />

                </Link>

            </div>

        </InfoPage>
    );
}
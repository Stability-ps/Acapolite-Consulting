# Acapolite Mobile App

This folder is the Capacitor shell for the existing React + Vite + Supabase application.

## Architecture

- Web application: repository root (Vite)
- Backend/Auth/Storage: existing Supabase project
- Mobile shell: Capacitor 8
- iOS bundle ID: `za.co.acapoliteconsulting.app`
- Android application ID: `za.co.acapoliteconsulting.app`
- Mobile web assets: `../dist`

The mobile build uses the same application and backend. It does not duplicate the Acapolite frontend.

## First-time setup

From `mobile/`:

```bash
npm install
npm run add:ios
npm run add:android
npm run sync
```

Then open a native project:

```bash
npm run open:ios
npm run open:android
```

## Normal development workflow

After web changes:

```bash
cd mobile
npm run sync
```

This builds the root Vite app with `--mode mobile`, copies `dist` into the native projects, and updates native plugins.

## Important mobile behavior

The root application detects a Capacitor native WebView at runtime. Native builds:

- receive safe-area classes for iPhone/Android display cutouts;
- do not start Microsoft Clarity;
- do not capture Google Ads attribution;
- use direct Supabase Edge Function URLs for WhatsApp QA/link operations.

The normal website behavior remains unchanged.

## Before App Store / Play Store submission

1. Generate and commit the `ios/` and `android/` projects.
2. Add final Acapolite app icon and launch assets.
3. Configure Apple signing/team and Android signing.
4. Configure Supabase auth redirect/deep-link URLs if mobile password reset or OAuth flows require them.
5. Add privacy disclosures and store metadata.
6. Run end-to-end tests for login, client portal, invoices/PDFs, uploads/downloads, WhatsApp admin, camera/file selection and logout.

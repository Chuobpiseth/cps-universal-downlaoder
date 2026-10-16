# Free device-bound licensing (optional future release)

The current CPS Universal Downloader build remains open and does not show a license screen. This document describes a free licensing option that can be enabled later without operating a paid or always-on API server.

## Recommended design: signed license files on GitHub Pages

Use a public GitHub Pages repository only to publish cryptographically signed license records. Public visibility is safe when the records contain no name, phone number, license key, raw hardware identifier, payment detail, or private signing key.

The desktop application contains only an Ed25519 **public** verification key. The Ed25519 **private** key stays in a GitHub Actions encrypted secret and must never be included in this repository, the EXE, a Telegram bot repository, logs, or a Google Sheet.

Each published record can use this shape:

```json
{
  "license_id": "random-public-id",
  "device_hash": "sha256-normalized-device-fingerprint",
  "edition": "premium",
  "issued_at": "2026-09-19T10:00:00Z",
  "expires_at": null,
  "status": "active",
  "signature": "base64-ed25519-signature"
}
```

Do not use a customer license key as the public filename. Generate a random activation code, hash it, and publish the record as `licenses/<activation-code-sha256>.json`.

## Sale and activation workflow

1. The app displays a device request code created from a normalized Windows Machine GUID and SMBIOS UUID. Hash the normalized value before it leaves the computer.
2. The customer sends the request code to the Telegram bot after payment.
3. You approve the order from a private admin chat.
4. A manually dispatched GitHub Actions workflow receives the request code, plan, and optional expiry date. It signs the canonical JSON payload using the encrypted Ed25519 private key and publishes the record to GitHub Pages.
5. You send the customer a random activation code.
6. The app hashes that code, downloads the corresponding JSON record over HTTPS, verifies its signature with the embedded public key, and compares `device_hash` using a constant-time comparison.
7. The verified record is cached with Windows DPAPI. The app can operate offline for a configurable grace period, such as 14 days, before checking the public record again.

Changing a license to `suspended` or replacing its signed record revokes it at the next online check. A computer replacement should require an admin-approved reissue with a new device hash.

## Why this is preferable to Google Sheets

- There is no database or web server to operate.
- A copied activation code fails on a different hardware fingerprint.
- A customer cannot edit a public license record without invalidating its signature.
- The signing key is not shipped to customers.
- GitHub Pages can serve simple static JSON over HTTPS.

Google Sheets can still be used privately as a sales ledger, but it must not decide whether a license is cryptographically valid. Never publish a sheet containing activation codes or device identifiers.

## Security and product rules

- Bind to a stable composite fingerprint, not a MAC address alone.
- Store only the hash of the fingerprint remotely.
- Provide a clear privacy notice and a manual device-reset policy.
- Sign the Windows EXE and future update manifests separately from license records.
- Never disable or delete customer files when validation fails. Use a grace period and switch premium actions to read-only mode.
- Expect determined attackers to patch a desktop application. Device binding prevents ordinary key sharing; it cannot guarantee that an offline EXE is impossible to modify.

## When to enable it

Keep the public/open edition while the download, subtitle, clip, and AI workflows are being tested. Enable licensing only in a separate paid build after the activation and recovery experience has automated tests and you have written refund, device-transfer, and privacy policies.

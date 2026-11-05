# Release

Compass Dialer is an internal tool. It ships to agents through **Play Console internal testing**
and **TestFlight internal testers**, never as a public store listing.

## Versioning

- `version` in `app.json` follows semver and is what agents see on the Account screen.
- Build numbers are managed remotely by EAS (`appVersionSource: remote`, `autoIncrement`).
- Every release gets a section in `CHANGELOG.md`.

## Before a release

1. `npm run verify` passes on `main`.
2. Run the [device test matrix](testing.md#real-device-test-matrix) on a `preview` build.
3. Move the _Unreleased_ entries in `CHANGELOG.md` under the new version and date.
4. Bump `version` in `app.json` if this is a new version (not just a new build).

## Android

```bash
eas build --profile production --platform android
eas submit --platform android --latest
```

Release to the **internal testing** track in Play Console. Testers (up to 100) are added by email
and update through the Play Store. The first upload of a new app has to be done by hand in Play
Console.

## iOS

```bash
eas build --profile production --platform ios
eas submit --platform ios --latest
```

Release to **TestFlight internal testers** (Apple team members, up to 100). Internal builds need
no App Review. TestFlight builds expire after 90 days, so a fresh build has to ship at least that
often.

## Over-the-air updates

JavaScript-only fixes can ship with `expo-updates` without a store build (to be enabled before
the first production release). Anything that touches `modules/sim-dialer`, `app.json` plugins or
native dependencies needs a new store build.

## App identity

Package / bundle id: `com.avataarskin.dialer` (`app.config.ts`). It can't change after the first
store upload without creating a new app.

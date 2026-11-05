# 0003: Expo + React Native, same stack as lume-mobile

- **Status:** Accepted
- **Date:** 2026-11-04

## Context

The app must run on Android and iOS. The organization's newest app, `lume-mobile`, uses Expo SDK
56, expo-router, TanStack Query, Zustand, expo-secure-store, EAS builds and a local Expo module for
native code (`modules/rw-ring`). `avataar-mobile-app` is also Expo.

## Decision

Use the same stack: Expo SDK 56, React Native 0.85, TypeScript (strict), expo-router, TanStack
Query v5, Zustand, expo-secure-store, EAS. Native calling code is a local Expo module
(`modules/sim-dialer`) in Kotlin and Swift, following `rw-ring`'s layout.

## Consequences

- One codebase for both platforms; developers can move between this app and lume-mobile.
- A development build is required (Expo Go can't load the native module).
- Expo SDK 56 needs Xcode 26+ for local iOS builds.

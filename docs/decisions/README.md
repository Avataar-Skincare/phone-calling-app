# Architecture decision records

Each record states a decision, its context and its consequences. Records are never edited after
they're accepted; a later record supersedes an earlier one and says so.

| #    | Decision                                                                                                                        | Date       | Status             |
| ---- | ------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------ |
| 0001 | [Calls go out on the agent's own SIM](0001-sim-calling.md)                                                                      | 2026-11-04 | Accepted           |
| 0002 | [Save outcomes through Compass's activity form](0002-save-outcomes-through-activity-form.md)                                    | 2026-11-04 | Superseded by 0005 |
| 0003 | [Expo + React Native, same stack as lume-mobile](0003-expo-react-native-stack.md)                                               | 2026-11-04 | Accepted           |
| 0004 | [Frontend-only repo; Compass stays the only backend](0004-frontend-only-repo.md)                                                | 2026-11-05 | Accepted           |
| 0005 | [Log each call as "Manual Outbound Call"; outcomes stay on the web](0005-log-calls-as-manual-outbound-call.md)                  | 2026-11-06 | Accepted           |
| 0006 | [Talk, ringing and total time; WhatsApp button; no outcomes, stage or task changes in the app](0006-call-times-and-whatsapp.md) | 2026-11-06 | Accepted           |
| 0007 | [Upload the phone dialer's call recording to Compass (Android)](0007-call-recording-upload.md)                                  | 2026-11-13 | Accepted           |
| 0008 | [Call-log access is required to call from the app on Android](0008-call-log-access-required.md)                                 | 2026-11-12 | Accepted           |
| 0009 | [Keypad dialing claims the lead before it dials](0009-keypad-claim.md)                                                          | 2026-11-13 | Accepted           |

New record: copy the format of an existing one, use the next number, add it to this table.

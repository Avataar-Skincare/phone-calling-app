# Architecture decision records

Each record states a decision, its context and its consequences. Records are never edited after
they're accepted; a later record supersedes an earlier one and says so.

| #    | Decision                                                                                                       | Date       | Status             |
| ---- | -------------------------------------------------------------------------------------------------------------- | ---------- | ------------------ |
| 0001 | [Calls go out on the agent's own SIM](0001-sim-calling.md)                                                     | 2026-11-04 | Accepted           |
| 0002 | [Save outcomes through Compass's activity form](0002-save-outcomes-through-activity-form.md)                   | 2026-11-04 | Superseded by 0005 |
| 0003 | [Expo + React Native, same stack as lume-mobile](0003-expo-react-native-stack.md)                              | 2026-11-04 | Accepted           |
| 0004 | [Frontend-only repo; Compass stays the only backend](0004-frontend-only-repo.md)                               | 2026-11-05 | Accepted           |
| 0005 | [Log each call as "Manual Outbound Call"; outcomes stay on the web](0005-log-calls-as-manual-outbound-call.md) | 2026-11-06 | Accepted           |
| 0006 | [Talk, ringing and total time; WhatsApp button; no outcome screen](0006-call-times-and-whatsapp.md)            | 2026-11-06 | Accepted           |

New record: copy the format of an existing one, use the next number, add it to this table.

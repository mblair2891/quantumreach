# Managed warm-up architecture

Quantum Reach owns the deterministic controller. Subscriber controls can pause or request review but cannot promote. The default ramp is 5/day (days 1–3), 10 (4–7), 15 (8–14), 25 (15–21), 30 (22–28), and 35 thereafter, bounded by a 105-message domain cap. Time alone never promotes.

Eligibility requires SPF, DKIM, DMARC, inbound/outbound tests, bounce/complaint/suppression pipelines, healthy provider/domain state, 21 days, 150 delivered samples, seven healthy days, delivery >=95%, hard bounce <2%, complaint <0.1%, and score >=90. Bounce >3% or complaint >=0.3% pauses. One persisted decision per mailbox/date makes evaluation retry-safe. Live health failures demote to PAUSED; RECOVERY begins below prior volume and requires new evidence. Simulation data is labeled and uniquely separated from live data.

## Preview operations and overrides

Operators can add simulated evidence one event at a time, queue an idempotent evaluation, assign a published policy, inspect decisions/reservations/holds, begin recovery, and create a narrowly scoped override lasting no more than seven days. Legal or abuse holds reject override creation. Expiration runs through the existing internal job runner and produces audit and notification intent records.

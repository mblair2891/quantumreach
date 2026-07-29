# Managed warm-up architecture

Quantum Reach owns the deterministic controller. Subscriber controls can pause or request review but cannot promote. The default ramp is 5/day (days 1–3), 10 (4–7), 15 (8–14), 25 (15–21), 30 (22–28), and 35 thereafter, bounded by a 105-message domain cap. Time alone never promotes.

Eligibility requires SPF, DKIM, DMARC, inbound/outbound tests, bounce/complaint/suppression pipelines, healthy provider/domain state, 21 days, 150 delivered samples, seven healthy days, delivery >=95%, hard bounce <2%, complaint <0.1%, and score >=90. Bounce >3% or complaint >=0.3% pauses. One persisted decision per mailbox/date makes evaluation retry-safe. Live health failures demote to PAUSED; RECOVERY begins below prior volume and requires new evidence. Simulation data is labeled and uniquely separated from live data.

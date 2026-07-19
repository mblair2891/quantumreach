# Course delivery architecture
Program offers use `CourseDeliveryType` (`SKOOL`, `SELF_HOSTED`, `EXTERNAL`, or `MANUAL`). Skool membership association is optional, so a disabled provider cannot block the SaaS runtime. A future LMS can attach courses, modules, lessons, and progress to `ProgramEnrollment` without changing orders.

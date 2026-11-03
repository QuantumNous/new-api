# Design

Store requests per minute on the subscription plan, using zero for no plan-specific limit to preserve existing plans. Select the highest configured limit among the user's active partner plans applicable to the request group. Apply it independently from the existing model limiter using an atomic shared Redis counter or the in-memory limiter. Continue existing subscription billing and expiration checks; make unlimited quota explicit in partner responses. Migrate both GORM and the bespoke SQLite table path.

Review fixes: cache immutable partner-account membership for one minute in a bounded local LRU, including non-members, and publish membership only after account provisioning commits. Ordinary users skip clock and subscription queries; partner plan rates and validity remain live database reads. Share external-user ID validation across account provisioning and plan activation: 1–128 valid Unicode code points after trimming, with no control characters.

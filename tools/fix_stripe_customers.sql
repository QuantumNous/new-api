-- fix_stripe_customers.sql
-- পুরনো Stripe customer ID মুছে দাও
-- পরবর্তী payment-এ Stripe নতুন customer তৈরি করবে

UPDATE users
SET stripe_customer = ''
WHERE stripe_customer IS NOT NULL AND stripe_customer <> '';

-- Verify
SELECT id, username, stripe_customer FROM users WHERE id IN (1, 3);

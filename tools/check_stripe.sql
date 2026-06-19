-- সব stripe_customer দেখো
SELECT id, username, email, stripe_customer
FROM users
WHERE stripe_customer IS NOT NULL AND stripe_customer <> ''
ORDER BY id;

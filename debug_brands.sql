-- Check all brands in the database
SELECT 
  b.id,
  b.user_id,
  b.company_name,
  b.created_at,
  p.email
FROM brands b
LEFT JOIN profiles p ON p.id = b.user_id
ORDER BY b.created_at DESC
LIMIT 10;

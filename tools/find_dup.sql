-- Find the duplicate claude-opus-4.8 IDs
SELECT id, model_name, icon, vendor_id, tags, created_time FROM models 
WHERE model_name = 'claude-opus-4.8' AND deleted_at IS NULL
ORDER BY created_time;

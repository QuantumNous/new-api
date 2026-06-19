SELECT model_name, vendor_id, LEFT(description, 80) as description_preview
FROM models
WHERE model_name IN (
  '[Bonus] Claude-opus-4.8',
  'claude-opus-4.8',
  'claude-fable-5'
)
AND deleted_at IS NULL
ORDER BY model_name;

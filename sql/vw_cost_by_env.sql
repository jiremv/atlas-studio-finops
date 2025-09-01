-- Replace <CUR_TABLE>. Adjust the tag column to your CUR tag naming convention (e.g., resource_tags_user_environment).
CREATE OR REPLACE VIEW vw_cost_by_env AS
SELECT
  CAST(line_item_usage_start_date AS date) AS usage_date,
  product_product_name AS service,
  resource_tags_user_environment AS environment,
  SUM(COALESCE(blended_cost, line_item_blended_cost)) AS cost_usd
FROM spectrum_cur.<CUR_TABLE>
GROUP BY 1,2,3;

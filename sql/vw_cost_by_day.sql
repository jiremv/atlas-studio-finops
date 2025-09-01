-- Replace <CUR_TABLE> with the actual table name discovered by Glue (e.g., aws_billing_cur_xxx).
CREATE OR REPLACE VIEW vw_cost_by_day AS
SELECT
  CAST(line_item_usage_start_date AS date) AS usage_date,
  bill_payer_account_id       AS payer_account_id,
  line_item_usage_account_id  AS linked_account_id,
  product_product_name        AS service,
  SUM(COALESCE(blended_cost, line_item_blended_cost)) AS cost_usd
FROM spectrum_cur.<CUR_TABLE>
GROUP BY 1,2,3,4;

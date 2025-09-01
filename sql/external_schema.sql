-- Create an external schema in Redshift pointing to Glue (cur_db).
-- Replace <ROLE_ARN> with the Redshift Spectrum role output from CDK.

CREATE EXTERNAL SCHEMA IF NOT EXISTS spectrum_cur
FROM DATA CATALOG
DATABASE 'cur_db'
IAM_ROLE '<ROLE_ARN>'
CREATE EXTERNAL DATABASE IF NOT EXISTS;

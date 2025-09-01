# Atlas Studio — FinOps
From AWS CUR to actionable insights. (CUR → S3 → Glue → Redshift → Grafana)

This repo delivers a minimal, production-leaning FinOps data pipeline:
- **CUR → S3 (Parquet)** via `AWS::CUR::ReportDefinition` (**deploy in `us-east-1`**).
- **Glue** database + crawler for schema/partitions discovery.
- **IAM Role for Redshift Spectrum** with S3 read on CUR prefix + Data Catalog read.
- **SQL views** for Redshift to power dashboards.
- **Grafana** dashboard JSON (overview).

## Quick Start

### 1) CDK deploy (TypeScript, CDK v2)
```bash
cd cdk
npm ci || npm install
npm run build
# IMPORTANT: Deploy in us-east-1 for CUR
npx cdk bootstrap aws://<ACCOUNT_ID>/us-east-1
npx cdk deploy --all
```
Outputs:
- **CurBucketName** (S3 bucket for CUR)
- **RedshiftSpectrumRoleArn** (attach/use this role for the external schema)

### 2) Redshift external schema + views
- Connect to Redshift (Serverless/Cluster).
- Run `sql/external_schema.sql` (replace `<ROLE_ARN>`).
- Find the CUR external table in Glue (e.g., `aws_billing_cur_xxx`) and replace `<CUR_TABLE>` in:
  - `sql/vw_cost_by_day.sql`
  - `sql/vw_cost_by_env.sql`

### 3) Grafana
- Add Redshift as a data source.
- Import `grafana/dashboards/atlas-overview.json` and select your datasource.

## Notes
- `AWS::CUR::ReportDefinition` must live in **us-east-1**.
- First CUR delivery can take **up to 24h**; then daily updates.
- If you already have a CUR, you may point the stack to that bucket/prefix.

## Security
- Private S3 bucket, SSL enforced, versioned.
- Bucket policy only allows CUR delivery principal with constrained `aws:SourceArn` & `aws:SourceAccount`.
- Spectrum role is least-privilege (S3 read on CUR prefix + Glue read).

## Autor
Paul Rivera

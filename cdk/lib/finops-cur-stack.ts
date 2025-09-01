import { Stack, StackProps, Duration, RemovalPolicy, CfnOutput, Aws } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as glue from 'aws-cdk-lib/aws-glue';
import * as cur from 'aws-cdk-lib/aws-cur'; // L1 (must be us-east-1)

export class FinopsCurStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // 1) Bucket for CUR (private, versioned)
    const bucket = new s3.Bucket(this, 'CurBucket', {
      bucketName: `finops-cur-${Aws.ACCOUNT_ID}-${Aws.REGION}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      versioned: true,
      lifecycleRules: [{ expiration: Duration.days(730) }],
      removalPolicy: RemovalPolicy.RETAIN
    });

    // 2) Bucket policy for CUR delivery
    const sourceArn = `arn:aws:cur:us-east-1:${Aws.ACCOUNT_ID}:definition/*`;
    bucket.addToResourcePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      principals: [new iam.ServicePrincipal('billingreports.amazonaws.com')],
      actions: ['s3:GetBucketAcl', 's3:GetBucketPolicy'],
      resources: [bucket.bucketArn],
      conditions: { StringEquals: { 'aws:SourceArn': sourceArn, 'aws:SourceAccount': Aws.ACCOUNT_ID } }
    }));
    bucket.addToResourcePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      principals: [new iam.ServicePrincipal('billingreports.amazonaws.com')],
      actions: ['s3:PutObject'],
      resources: [`${bucket.bucketArn}/*`],
      conditions: { StringEquals: { 'aws:SourceArn': sourceArn, 'aws:SourceAccount': Aws.ACCOUNT_ID } }
    }));

    // 3) Glue Database + Crawler
    const glueDb = new glue.CfnDatabase(this, 'CurDatabase', {
      catalogId: this.account,
      databaseInput: { name: 'cur_db' }
    });

    const crawlerRole = new iam.Role(this, 'GlueCrawlerRole', {
      assumedBy: new iam.ServicePrincipal('glue.amazonaws.com')
    });
    bucket.grantRead(crawlerRole, 'cur/*');
    crawlerRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSGlueServiceRole'));

    new glue.CfnCrawler(this, 'CurCrawler', {
      name: 'cur-crawler',
      role: crawlerRole.roleArn,
      databaseName: glueDb.ref,
      targets: { s3Targets: [ { path: `s3://${bucket.bucketName}/cur/` } ] },
      schedule: { scheduleExpression: 'cron(0 6 * * ? *)' }, // daily 06:00 UTC
      schemaChangePolicy: {
        updateBehavior: 'UPDATE_IN_DATABASE',
        deleteBehavior: 'DEPRECATE_IN_DATABASE'
      }
    });

    // 4) IAM Role for Redshift Spectrum
    const spectrumRole = new iam.Role(this, 'RedshiftSpectrumRole', {
      assumedBy: new iam.ServicePrincipal('redshift.amazonaws.com')
    });
    bucket.grantRead(spectrumRole, 'cur/*');
    spectrumRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'glue:GetDatabase','glue:GetDatabases',
        'glue:GetTable','glue:GetTables',
        'glue:GetPartition','glue:GetPartitions',
        'athena:GetDataCatalog'
      ],
      resources: ['*']
    }));

    // 5) CUR Definition (Parquet + Athena)
    new cur.CfnReportDefinition(this, 'CurDefinition', {
      reportName: 'finops-daily',
      timeUnit: 'DAILY',
      format: 'Parquet',
      compression: 'Parquet',
      s3Bucket: bucket.bucketName,
      s3Region: Aws.REGION,
      s3Prefix: 'cur',
      additionalSchemaElements: ['RESOURCES','SPLIT_COST_ALLOCATION_DATA'],
      additionalArtifacts: ['ATHENA'],
      refreshClosedReports: true,
      reportVersioning: 'OVERWRITE_REPORT'
    });

    new CfnOutput(this, 'CurBucketName', { value: bucket.bucketName });
    new CfnOutput(this, 'RedshiftSpectrumRoleArn', { value: spectrumRole.roleArn });
  }
}

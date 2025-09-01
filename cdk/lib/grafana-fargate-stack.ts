import { Stack, StackProps, CfnOutput, RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as secrets from 'aws-cdk-lib/aws-secretsmanager';

export interface GrafanaStackProps extends StackProps {
  vpcId?: string;       // use existing VPC if provided
  allowedCidr?: string; // default 0.0.0.0/0; restrict to your IP in prod
}

export class GrafanaFargateStack extends Stack {
  constructor(scope: Construct, id: string, props: GrafanaStackProps = {}) {
    super(scope, id, props);

    const vpc = props.vpcId
      ? ec2.Vpc.fromLookup(this, 'ExistingVpc', { vpcId: props.vpcId })
      : new ec2.Vpc(this, 'AtlasVpc', { maxAzs: 2, natGateways: 1 });

    const adminSecret = new secrets.Secret(this, 'GrafanaAdminSecret', {
      secretName: 'grafana/admin',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'admin' }),
        generateStringKey: 'password',
        excludePunctuation: true
      },
      removalPolicy: RemovalPolicy.DESTROY
    });

    const cluster = new ecs.Cluster(this, 'GrafanaCluster', { vpc });

    const logGroup = new logs.LogGroup(this, 'GrafanaLogs', {
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: RemovalPolicy.DESTROY
    });

    const svc = new ecsPatterns.ApplicationLoadBalancedFargateService(this, 'GrafanaSvc', {
      cluster,
      cpu: 512,
      memoryLimitMiB: 1024,
      desiredCount: 1,
      publicLoadBalancer: true,
      taskImageOptions: {
        image: ecs.ContainerImage.fromRegistry('grafana/grafana:10.4.0'),
        containerPort: 3000,
        logDriver: ecs.LogDrivers.awsLogs({ streamPrefix: 'grafana', logGroup }),
        environment: {
          GF_SERVER_ROOT_URL: '/',
          GF_USERS_ALLOW_SIGN_UP: 'false'
        },
        secrets: {
          GF_SECURITY_ADMIN_USER: ecs.Secret.fromSecretsManager(adminSecret, 'username'),
          GF_SECURITY_ADMIN_PASSWORD: ecs.Secret.fromSecretsManager(adminSecret, 'password')
        }
      },
      listenerPort: 80
    });

    const allowedCidr = props.allowedCidr ?? '0.0.0.0/0';
    svc.loadBalancer.connections.allowFrom(
      ec2.Peer.ipv4(allowedCidr),
      ec2.Port.tcp(80),
      'Allow HTTP access'
    );

    // Optionally allow outbound to Redshift port (5439)
    svc.service.connections.allowToAnyIpv4(ec2.Port.tcp(5439), 'Outbound to Redshift');

    new CfnOutput(this, 'GrafanaURL', { value: `http://${svc.loadBalancer.loadBalancerDnsName}` });
    new CfnOutput(this, 'GrafanaAdminSecretName', { value: adminSecret.secretName });
  }
}

import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import { aws_secretsmanager as secretsmanager } from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import { aws_apigateway as apigateway } from 'aws-cdk-lib';

export class CartServiceCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const cartServiceDbCredentialsSecret = new secretsmanager.Secret(
      this,
      'CartServiceDBCredentials',
      {
        secretName: 'CartServiceDBCredentialsName',
        generateSecretString: {
          secretStringTemplate: JSON.stringify({
            username: 'cart_service_admin_user'
          }),
          excludePunctuation: true,
          includeSpace: false,
          generateStringKey: 'password'
        }
      });

    //  1. VPC (required for RDS + Lambda connectivity)
    // - since RDS only exists inside a VPC
    // - lambda must be placed in same VPC to connect
    const vpc = new ec2.Vpc(this, 'CartServiceVpc', {
      maxAzs: 2, // Default is all AZs in the region
      // natGateways: 1, // 1 minimal but production-valid
      // NAT Gateway ≈ $30–40/month, this Lambda DOES NOT need internet
      natGateways: 0, // cheaper 
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'IsolatedSubnet',
          // subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS, // outcoing traffic - ingress forbidden, good but PRIVATE_WITH_EGRESS requires a NAT Gateway
          // subnetType: ec2.SubnetType.PUBLIC, // RDS should NOT be in public subnets
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED
        },
      ],
    });

    // MUST allow Lambda to access Secrets Manager
    // Lambda → Secrets Manager (inside VPC)
    // No NAT required 
    vpc.addInterfaceEndpoint('SecretsManagerEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
    });


    // 2. Security Groups
    const lambdaSG = new ec2.SecurityGroup(this, 'LambdaSG', { // outbound traffic
      vpc,
      allowAllOutbound: true,
      description: 'Security group for Cart Service Lambda',
    });

    const rdsSG = new ec2.SecurityGroup(this, 'RdsSG', { // inbound control
      vpc,
      allowAllOutbound: true,
      // db is private, only accessible from lambda
      description: 'Security group for Cart Service PostgreSQL RDS',
    });


    // Allow Lambda → RDS (Postgres 5432) - allowDefaultPortFrom does the same
    // rdsSG.addIngressRule(
    //   lambdaSG,
    //   ec2.Port.tcp(5432),
    //   'Allow Lambda access to PostgreSQL'
    // );


    // 3. RDS PostgreSQL Instance
    const db = new rds.DatabaseInstance(this, 'CartPostgres', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_15,
      }),

      instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE3, ec2.InstanceSize.MICRO),

      vpc,
      // RDS (DatabaseInstance) by default looks for private subnets
      // CDK does not assume isolated subnets are OK unless you say so explicitly
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },

      securityGroups: [rdsSG],

      credentials: rds.Credentials.fromSecret(cartServiceDbCredentialsSecret), //.fromGeneratedSecret('postgres'), - auto password

      databaseName: 'cartdb',

      allocatedStorage: 10,
      maxAllocatedStorage: 100,

      multiAz: false, // training-friendly
      publiclyAccessible: false,

      allowMajorVersionUpgrade: false,
      autoMinorVersionUpgrade: true,
      backupRetention: cdk.Duration.days(7),
      deleteAutomatedBackups: true,

      removalPolicy: cdk.RemovalPolicy.DESTROY, // training only
      deletionProtection: false,
      // monitoringInterval: cdk.Duration.seconds(60), // Enhanced Monitoring for RDS $0.015 per hour per DB instance, ≈ $10–11 per month
      // cloudwatchLogsExports: ['postgresql'], // cents per day, often < $1 total if you destroy quickly
    });

    // 4. Lambda (inside VPC)

    const lambdaFunction = new lambda.Function(this, 'NestLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,

      handler: 'src/lambda.handler',

      code: lambda.Code.fromAsset(
        path.resolve(__dirname, '../../dist')
      ),

      memorySize: 1024,
      timeout: cdk.Duration.seconds(30),

      vpc,
      securityGroups: [lambdaSG],

      environment: {
        DB_SECRET_ARN: cartServiceDbCredentialsSecret.secretArn,
        DB_HOST: db.instanceEndpoint.hostname,
        DB_PORT: db.instanceEndpoint.port.toString(),
        DB_NAME: 'cartdb',
        DB_USERNAME: 'cart_service_admin_user',
      }
    });
    // const lambdaFunction = new lambdaNodejs.NodejsFunction(this, 'NestLambda', {
    //   runtime: lambda.Runtime.NODEJS_20_X,


    //   // entry: path.resolve(__dirname, '../../dist/src/lambda.js'), // use built file
    //   handler: 'handler',

    //   projectRoot: path.resolve(__dirname, '../../'),
    //   // entry: path.resolve(__dirname, '../../src/lambda.ts'),
    //   entry: path.resolve(__dirname, '../../src/entry.ts'),

    //   memorySize: 1024, // better for Nest cold start
    //   timeout: cdk.Duration.seconds(30),
    //   vpc, // Associate the Lambda function with the VPC
    //   // allowPublicSubnet: true, // that is bad
    //   securityGroups: [lambdaSG],
    //   environment: {
    //     DB_SECRET_ARN: cartServiceDbCredentialsSecret.secretArn,
    //     DB_HOST: db.instanceEndpoint.hostname,
    //     DB_PORT: db.instanceEndpoint.port.toString(),
    //     DB_NAME: 'cartdb',
    //     DB_USERNAME: 'cart_service_admin_user',
    //   },

    //   bundling: {
    //     tsconfig: path.resolve(__dirname, '../../tsconfig.json'),
    //     // esbuild will NOT bundle these packages
    //     // But they MUST exist in node_modules at runtime
    //     // Lambda loads them using normal require()
    //     // Where do those dependencies come from then?
    //     // CDK does this:

    //     // Uses your local node_modules
    //     // Zips:

    //     //  dist/**
    //     //  node_modules/**


    //     // Uploads to Lambda

    //     // No internet needed at runtime
    //     externalModules: [
    //       // don't bundle optional Nest deps
    //       // 'pg',
    //       // 'typeorm',
    //       // 'reflect-metadata',
    //       'expo-sqlite',
    //       'class-transformer',
    //       'class-validator',
    //       '@nestjs/microservices',
    //       '@nestjs/websockets',
    //     ],
    //     minify: false, // critical for Nest DI
    //     sourceMap: true,
    //     keepNames: true,
    //     // banner: 'require("reflect-metadata");',
    //     // minify: true, // smaller bundle
    //   },
    // });

    // 5. Allow Lambda to read DB credentials
    db.secret?.grantRead(lambdaFunction);
    cartServiceDbCredentialsSecret.grantRead(lambdaFunction);
    db.connections.allowDefaultPortFrom(lambdaFunction)

    const api = new apigateway.RestApi(this, 'NestApi', {
      restApiName: 'Nest Service',
      description: 'This service serves a Nest.js application.',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
          'X-Amz-Security-Token',
        ],
      },
    });

    const integration = new apigateway.LambdaIntegration(lambdaFunction, {
      proxy: true,
    });

    api.root.addProxy({
      defaultIntegration: integration,
      anyMethod: true,
    });

    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
    });

    new cdk.CfnOutput(this, 'DbEndpoint', {
      value: db.instanceEndpoint.hostname,
    });


    new cdk.CfnOutput(this, 'DbSecretArn', {
      value: cartServiceDbCredentialsSecret.secretArn,
    });

  }
}

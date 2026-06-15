import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import { aws_apigateway as apigateway } from 'aws-cdk-lib';

export class CartServiceCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const lambdaFunction = new lambdaNodejs.NodejsFunction(this, 'NestLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,

      // entry: path.resolve(__dirname, '../../src/lambda.ts'), // safer than join
      entry: path.resolve(__dirname, '../../dist/src/lambda.js'), // use built file
      handler: 'handler',

      projectRoot: path.resolve(__dirname, '../../'),

      memorySize: 1024, // ✅ better for Nest cold start
      timeout: cdk.Duration.seconds(30),

      bundling: {
        externalModules: [
          // don't bundle optional Nest deps
          'class-transformer',
          'class-validator',
          '@nestjs/microservices',
          '@nestjs/websockets',
        ],
        minify: false, // critical for Nest DI
        // minify: true, // smaller bundle
      },
    });

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
  }
}


// import * as path from 'path';
// import * as cdk from 'aws-cdk-lib/core';
// import { Construct } from 'constructs';
// import * as lambda from 'aws-cdk-lib/aws-lambda';
// import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
// import { aws_apigateway as apigateway } from 'aws-cdk-lib';

// export class CartServiceCdkStack extends cdk.Stack {
//   constructor(scope: Construct, id: string, props?: cdk.StackProps) {
//     super(scope, id, props);


//     const lambdaFunction = new lambdaNodejs.NodejsFunction(this, 'NestLambda', {
//       runtime: lambda.Runtime.NODEJS_20_X,

//       entry: path.join(__dirname, '../../src/lambda.ts'),
//       handler: 'handler',
//       memorySize: 512,
//       timeout: cdk.Duration.seconds(10),
//       projectRoot: path.resolve(__dirname, '../../'),
//       // forceDockerBundling: false,
//       depsLockFilePath: path.resolve(__dirname, '../../package-lock.json'),
//       bundling: {

//         externalModules: [
//           'class-transformer',
//           'class-validator',
//           '@nestjs/microservices',
//           '@nestjs/websockets',
//         ],


//         nodeModules: [
//           // '@nestjs/common',
//           // '@nestjs/core',y
//           // '@nestjs/platform-express',
//           // 'reflect-metadata',
//           // 'rxjs',
//           // '@vendia/serverless-express',
//           // 'express'
//         ],
//       },

//     });

//     const api = new apigateway.RestApi(this, 'NestApi', {
//       restApiName: 'Nest Service',
//       description: 'This service serves a Nest.js application.',

//       defaultCorsPreflightOptions: {
//         allowOrigins: apigateway.Cors.ALL_ORIGINS,
//         allowMethods: apigateway.Cors.ALL_METHODS,
//         allowHeaders: [
//           'Content-Type',
//           'X-Amz-Date',
//           'Authorization',
//           'X-Api-Key',
//           'X-Amz-Security-Token',
//         ],
//       },

//     });


//     const integration = new apigateway.LambdaIntegration(lambdaFunction, {
//       proxy: true,
//     });

//     api.root.addProxy({
//       defaultIntegration: integration,
//       anyMethod: true,
//     });

//     new cdk.CfnOutput(this, 'ApiUrl', {
//       value: api.url,
//     });

//   }
// }

// import 'reflect-metadata';
import { Context, Handler } from 'aws-lambda';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
// import * as express from 'express';
import express from 'express';
import { AppModule } from './app.module';
import helmet from 'helmet';
// const serverlessExpress = require('@vendia/serverless-express');
import serverlessExpress from '@vendia/serverless-express';
let server: Handler;

async function bootstrap(): Promise<Handler> {
  const expressApp = express();

  expressApp.use(express.json());
  expressApp.use(express.urlencoded({ extended: true }));

  const app = await NestFactory.create(
    AppModule,
    new ExpressAdapter(expressApp),
  );


  app.enableCors({
    origin: (req, callback) => callback(null, true),
  });
  app.use(helmet());

  await app.init();

  return serverlessExpress({ app: expressApp });
}

// This is what CDK will point to as Lambda entry.
export const handler: Handler = async (event, context: Context, callback) => {
  try {
    console.log('RAW EVENT BODY:', event.body);
    if (!server) {
      server = await bootstrap();
    }
    return server(event, context, callback);

  } catch (err: any) {
    console.error('FATAL ERROR:', err);

    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Lambda failed',
        error: err?.message,
      }),
    };
  }

};

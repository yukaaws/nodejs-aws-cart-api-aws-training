
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';


@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: async () => {
        const client = new SecretsManagerClient({});

        const command = new GetSecretValueCommand({
          SecretId: process.env.DB_SECRET_ARN!,
        });

        const response = await client.send(command);

        const secret = JSON.parse(response.SecretString!);

        return {
          type: 'postgres',

          host: process.env.DB_HOST,
          port: Number(process.env.DB_PORT),

          username: secret.username,
          password: secret.password,

          database: process.env.DB_NAME,

          autoLoadEntities: true,
          synchronize: true,

          ssl: {
            rejectUnauthorized: false,
          },
        };
      },
    }),
  ],
})
export class DatabaseModule {}

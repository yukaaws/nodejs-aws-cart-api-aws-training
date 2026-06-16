
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';

const client = new SecretsManagerClient({});

export async function getDbCredentials() {
  const command = new GetSecretValueCommand({
    SecretId: process.env.DB_SECRET_ARN!,
  });

  const response = await client.send(command);

  const secret = JSON.parse(response.SecretString!);

  return {
    username: secret.username,
    password: secret.password,
  };
}

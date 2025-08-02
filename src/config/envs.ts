import 'dotenv/config';
import * as joi from 'joi';

interface EnvVars {
  PORT: number;
  NATS_SERVERS: string[];
}

const envVarsSchema = joi
  .object<EnvVars>({
    PORT: joi.number().default(3000),
    NATS_SERVERS: joi
      .array()
      .items(joi.string().uri())
      .required()
      .default(['nats://localhost:4222']),
  })
  .unknown();

const { error, value: envVars } = envVarsSchema.validate({
  ...process.env,
  NATS_SERVERS: process.env.NATS_SERVERS?.split(','),
});
if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

export const envs = {
  port: envVars.PORT,
  natsServers: envVars.NATS_SERVERS,
};

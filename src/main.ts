import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { envs } from './config';

async function bootstrap() {
  const logger = new Logger('Orders-Main');

  const app = await NestFactory.create(AppModule);
  await app.listen(envs.port);

  logger.log(`Microservice is running on: http://localhost:${envs.port}`);
}
bootstrap();

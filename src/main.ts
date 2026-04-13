import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');

  //2.Enable Validation globally
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  //3. register global exception filter
  app.useGlobalFilters(new AllExceptionsFilter());

  //4. app.enableCors(); // Enable CORS if needed
  app.enableCors();
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();

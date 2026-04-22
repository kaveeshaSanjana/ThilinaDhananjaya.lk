import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { createConnection } from 'node:net';
import cookieParser = require('cookie-parser');
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

function isPortInUseOnHost(port: number, host: string): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ port, host });

    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });

    socket.once('error', (error: any) => {
      if (error?.code === 'ECONNREFUSED') {
        resolve(false);
      } else {
        resolve(true);
      }
    });

    socket.setTimeout(1000, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

async function isPortInUse(port: number): Promise<boolean> {
  const inUseIpv4 = await isPortInUseOnHost(port, '127.0.0.1');
  if (inUseIpv4) return true;

  const inUseIpv6 = await isPortInUseOnHost(port, '::1');
  return inUseIpv6;
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const port = Number(process.env.PORT || 8080);

  try {
    const app = await NestFactory.create(AppModule);
    logger.log('NestFactory app created successfully');

    app.use(cookieParser());

    app.enableCors({
      origin: true, // Allow all origins (public registration endpoint requires this)
      credentials: true,
    });

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );

    app.useGlobalFilters(new HttpExceptionFilter());

    app.setGlobalPrefix('api');

    await app.listen(port, '0.0.0.0');
    logger.log(`✓ ThilinaDhananjaya LMS Backend running on http://0.0.0.0:${port}`);
  } catch (error: any) {
    const logger = new Logger('Bootstrap');
    if (error?.code === 'EADDRINUSE') {
      logger.error(`Port ${port} is already in use.`);
      process.exit(1);
    }
    logger.error(`Failed to start app: ${error?.message || error}`, error?.stack);
    process.exit(1);
  }
}

bootstrap();




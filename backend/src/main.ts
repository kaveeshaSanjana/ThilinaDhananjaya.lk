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
  const port = Number(process.env.PORT || 3000);

  const portInUse = await isPortInUse(port);
  if (portInUse) {
    logger.warn(`Port ${port} is already in use. Another backend instance is already running.`);
    return;
  }

  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());

  const configuredOrigins = (process.env.FRONTEND_URL || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  const defaultDevOrigins = ['http://localhost:5173', 'http://localhost:5174'];
  const allowedOrigins = new Set([...configuredOrigins, ...defaultDevOrigins]);

  app.enableCors({
    origin: (origin, callback) => {
      const isLocalhostDevOrigin =
        process.env.NODE_ENV !== 'production' &&
        !!origin &&
        /^http:\/\/localhost:\d+$/.test(origin);

      if (!origin || allowedOrigins.has(origin) || isLocalhostDevOrigin) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
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

  try {
    await app.listen(port);
    logger.log(`ThilinaDhananjaya LMS Backend running on http://localhost:${port}`);
  } catch (error: any) {
    if (error?.code === 'EADDRINUSE') {
      logger.warn(`Port ${port} is already in use. Another backend instance is already running.`);
      await app.close();
      return;
    }
    throw error;
  }
}
bootstrap();

import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import type { AppConfig } from './config/configuration';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    // 生产环境关掉 debug/verbose，只留 log/warn/error
    logger:
      process.env.NODE_ENV === 'production'
        ? ['log', 'warn', 'error']
        : ['log', 'warn', 'error', 'debug'],
  });

  const config = app.get(ConfigService);
  const appConfig = config.get<AppConfig>('') ?? ({} as AppConfig);
  const port = appConfig.port ?? 3000;
  const prefix = appConfig.apiPrefix ?? 'api/v1';

  // ---------------------------------------------------------------------------
  // 全局管道：DTO 校验 + 类型转换
  //   whitelist            —— 剥掉 DTO 里没声明的字段（防止脏字段透传进数据库）
  //   forbidNonWhitelisted —— 传了多余字段直接报错，比静默忽略更容易发现前端写错
  //   transform            —— 把 query 里的字符串 "1" 转成 number
  // ---------------------------------------------------------------------------
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  // ---------------------------------------------------------------------------
  // 全局过滤器 / 拦截器：统一响应体，统一异常结构
  //   顺序很重要：拦截器负责成功路径，过滤器负责失败路径，两者输出同一套结构
  // ---------------------------------------------------------------------------
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());

  app.setGlobalPrefix(prefix, {
    // 健康检查不挂在 /api/v1 下，方便容器编排的探针直接访问
    exclude: ['health'],
  });

  app.enableCors({
    origin: true,
    credentials: true,
  });

  // ---------------------------------------------------------------------------
  // Swagger 接口文档
  // ---------------------------------------------------------------------------
  if (appConfig.swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('mall-admin 商家管理端 API')
      .setDescription(
        '电商后台管理系统 · 商家管理端接口文档。\n\n' +
          '统一响应体：`{ code, message, data, traceId }`，`code = 0` 表示成功。\n' +
          '接口级权限通过 `@RequirePermission("模块:资源:动作")` 声明。',
      )
      .setVersion('1.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' },
        'access-token',
      )
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup(`${prefix}/docs`, app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  await app.listen(port, '0.0.0.0');

  const logger = new Logger('Bootstrap');
  logger.log(`服务已启动: http://localhost:${port}/${prefix}`);
  logger.log(`健康检查:   http://localhost:${port}/health`);
  if (appConfig.swaggerEnabled) {
    logger.log(`接口文档:   http://localhost:${port}/${prefix}/docs`);
  }
}

void bootstrap();

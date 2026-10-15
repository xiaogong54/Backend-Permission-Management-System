import { type INestApplication, Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { traceIdMiddleware } from './common/middleware/trace-id.middleware';
import type { AppConfig } from './config/configuration';

/**
 * 应用全局配置
 *
 * ★ 为什么要单独抽成一个函数，而不是写在 main.ts 里
 *
 *   这里注册的全局管道 / 过滤器 / 拦截器，直接决定了接口的**真实行为**：
 *     · 响应体长什么样（{ code, message, data, traceId }）
 *     · 异常怎么返回、HTTP 状态码怎么定
 *     · DTO 怎么校验、多余字段会不会被拒绝
 *
 *   如果 e2e 测试自己另写一套，测出来的就不是线上行为 ——
 *   "测试全绿但线上出问题"最常见的原因就是这个。
 *   抽成函数让生产与测试共用同一份，从结构上杜绝漂移。
 *
 * @returns 解析后的应用配置，调用方（main.ts）用它决定监听端口等
 */
export function configureApp(app: INestApplication): AppConfig {
  const config = app.get(ConfigService);
  const appConfig = config.get<AppConfig>('') ?? ({} as AppConfig);
  const prefix = appConfig.apiPrefix ?? 'api/v1';

  // ---------------------------------------------------------------------------
  // traceId 中间件 —— 必须是第一个注册的
  //
  // ★ 为什么它是中间件而不是拦截器
  //   NestJS 的执行顺序是「中间件 → 守卫 → 拦截器 → 管道 → 控制器」。
  //   守卫抛异常时（401 / 403）拦截器根本不会执行，路由没匹配上时（404）
  //   更是连控制器都没有 —— 这两种情况的 traceId 就会是空的。
  //   而 traceId 的价值恰恰在出错时。放在中间件里才能覆盖所有出口。
  //
  //   详见 common/middleware/trace-id.middleware.ts 的注释。
  // ---------------------------------------------------------------------------
  app.use(traceIdMiddleware);

  // ---------------------------------------------------------------------------
  // 全局管道：DTO 校验 + 类型转换
  //   whitelist            —— 剥掉 DTO 里没声明的字段，防止脏字段透传进数据库
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
  // 全局过滤器 / 拦截器：成功路径与失败路径输出同一套结构
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

  return appConfig;
}

/** 启动完成后的日志，抽出来是为了让 main.ts 更短 */
export function logBootstrap(appConfig: AppConfig): void {
  const port = appConfig.port ?? 3000;
  const prefix = appConfig.apiPrefix ?? 'api/v1';
  const logger = new Logger('Bootstrap');

  logger.log(`服务已启动: http://localhost:${port}/${prefix}`);
  logger.log(`健康检查:   http://localhost:${port}/health`);
  if (appConfig.swaggerEnabled) {
    logger.log(`接口文档:   http://localhost:${port}/${prefix}/docs`);
  }
}

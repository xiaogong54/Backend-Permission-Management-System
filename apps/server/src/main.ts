import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp, logBootstrap } from './setup-app';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    // 生产环境关掉 debug/verbose，只留 log/warn/error
    logger:
      process.env.NODE_ENV === 'production'
        ? ['log', 'warn', 'error']
        : ['log', 'warn', 'error', 'debug'],
  });

  // 全局管道 / 过滤器 / 拦截器 / Swagger 都在这里注册。
  // 抽成共用函数是为了让 e2e 测试复用同一套配置 —— 详见 setup-app.ts 的注释。
  const appConfig = configureApp(app);

  await app.listen(appConfig.port ?? 3000, '0.0.0.0');
  logBootstrap(appConfig);
}

void bootstrap();

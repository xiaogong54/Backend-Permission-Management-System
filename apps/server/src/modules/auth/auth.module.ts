import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, type JwtSignOptions } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

/**
 * 认证模块
 *
 * 后续还会加进来：
 *   · POST /auth/logout    退出登录（把 token 加进黑名单）
 *   · GET  /auth/profile   当前登录人信息 + 角色 + 权限码
 *   · GET  /auth/menus     动态菜单树
 *   · PUT  /auth/password  修改自己的密码
 */
@Module({
  imports: [
    /**
     * registerAsync 而不是 register：
     *   JWT 密钥来自环境变量，而环境变量要等 ConfigModule 初始化后才能读。
     *   registerAsync 让 Nest 先解析依赖（ConfigService），再调用工厂函数。
     *
     * 用 getOrThrow 而不是 get：
     *   密钥缺失时必须立刻启动失败。如果这里拿到 undefined，
     *   jsonwebtoken 会用一个空密钥签发 token —— 等于谁都能伪造登录态，
     *   而且不会有任何报错。这种"静默失效"必须在启动阶段就拦下来。
     */
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          /**
           * 这里的类型断言是为了兼容 @types/jsonwebtoken 9.0.10：
           * 它把 expiresIn 收紧成了模板字面量类型（如 `${number}h`），
           * 而环境变量天然是普通 string。运行时的格式由 .env.example 约束。
           */
          expiresIn: (config.get<string>('JWT_ACCESS_EXPIRES_IN') ??
            '2h') as JwtSignOptions['expiresIn'],
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  // 导出 JwtModule 是为了让后面的 JwtAuthGuard 能注入 JwtService 验签
  exports: [AuthService, JwtModule],
})
export class AuthModule {}

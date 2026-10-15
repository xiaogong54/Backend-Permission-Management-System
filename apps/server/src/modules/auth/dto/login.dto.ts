import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length, MaxLength } from 'class-validator';

/**
 * 登录请求参数
 *
 * 为什么四个字段全部用 @IsNotEmpty 而不是 @IsOptional：
 *   登录接口是攻击面最大的一处，参数校验要"宁可严格"。
 *   少传任何一个字段都应该明确报错，而不是让后续代码去处理 undefined。
 */
export class LoginDto {
  @ApiProperty({ description: '管理员账号', example: 'admin' })
  @IsString()
  @IsNotEmpty({ message: '请输入账号' })
  @MaxLength(32, { message: '账号长度不能超过 32 个字符' })
  username!: string;

  @ApiProperty({ description: '登录密码', example: 'Admin@123456' })
  @IsString()
  @IsNotEmpty({ message: '请输入密码' })
  /**
   * 上限 72 的来历：BCrypt 只取密码的前 72 个**字节**，超出部分被静默丢弃。
   * 这意味着超长密码的后半段其实毫无作用，用户以为更安全，实际没有。
   * 这里按字符数卡一个更保守的 64，避免中文密码（3 字节/字）悄悄越界。
   */
  @MaxLength(64, { message: '密码长度不能超过 64 个字符' })
  password!: string;

  @ApiProperty({ description: '验证码标识，来自 GET /auth/captcha' })
  @IsString()
  @IsNotEmpty({ message: '验证码已失效，请点击图片刷新' })
  captchaId!: string;

  @ApiProperty({ description: '用户填写的验证码', example: 'ab12' })
  @IsString()
  @Length(4, 4, { message: '验证码为 4 位字符' })
  captcha!: string;
}

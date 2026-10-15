/**
 * commitlint 配置
 *
 * 强制使用 Conventional Commits 规范：
 *   <type>(<scope>): <subject>
 *
 *   feat(server): 新增管理员登录接口
 *   fix(web): 修复侧边栏折叠后图标未居中
 *   docs: 补充数据库设计说明
 *
 * 为什么要强制：
 *   1. 提交历史可读，面试官翻 git log 能直接看出你在做什么
 *   2. 后续若要自动生成 CHANGELOG、按 type 决定版本号，规范是前提
 *   3. 一次提交只做一件事，出问题能精确 revert
 */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // 允许的提交类型
    'type-enum': [
      2,
      'always',
      [
        'feat', // 新功能
        'fix', // 修 bug
        'docs', // 只改文档
        'style', // 不影响逻辑的格式调整
        'refactor', // 重构（既非新功能也非修 bug）
        'perf', // 性能优化
        'test', // 增删改测试
        'build', // 构建系统或依赖变更
        'ci', // CI 配置
        'chore', // 杂项
        'revert', // 回滚
      ],
    ],
    // 允许的范围（模块名），不在这里的会报警告而非报错，避免约束过死
    'scope-enum': [
      1,
      'always',
      ['server', 'web', 'shared', 'db', 'docs', 'deps', 'config', 'release'],
    ],
    'subject-case': [0],
    'subject-max-length': [2, 'always', 72],
    'header-max-length': [2, 'always', 100],
    'body-max-line-length': [0],
  },
};

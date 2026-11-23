export default {
  rules: {
    'type-enum': [2, 'always', ['feat', 'fix', 'refactor', 'perf', 'docs', 'test', 'build', 'ci', 'chore', 'revert', 'style']],
    'scope-enum': [2, 'always', [
      'auth', 'db', 'rls', 'ai', 'rag', 'chat', 'courses', 'portal', 'admin', 'ui',
      'docs', 'ci', 'deps', 'demo', 'config', 'deploy', 'repo',
    ]],
    'subject-case': [2, 'never', ['sentence-case', 'start-case', 'pascal-case', 'upper-case']],
    'subject-empty': [2, 'never'],
    'subject-full-stop': [2, 'never', '.'],
    'header-max-length': [2, 'always', 100],
    'body-max-line-length': [1, 'always', 100],
    'footer-leading-blank': [1, 'always'],
  },
};

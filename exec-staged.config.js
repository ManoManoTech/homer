module.exports = [
  {
    regex: /\.(js|tsx?)$/,
    commands: ['eslint'],
  },
  {
    regex: /\.(js|json|md|tsx?|ya?ml)$/,
    commands: ['prettier --write', 'git add'],
  },
];
